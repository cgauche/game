import { useEffect, useRef, useState } from 'react';
import { diamondCorners, type Dims } from '../../geometry/iso';

/** Boîte visée, en PIXELS du contenu défilable (repère du conteneur, défilement inclus). */
export type ScrollBox = { left: number; top: number; right: number; bottom: number };
/** Fenêtre de défilement — les seules mesures lues sur le conteneur (un `HTMLElement` les porte toutes). */
export type ScrollPort = {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
};

/**
 * Défilement à appliquer pour CENTRER `box` dans `port`, borné au contenu — `null` quand la boîte y est
 * DÉJÀ entièrement visible : on n'amène au centre que ce qui manque au champ, jamais la vue en cours.
 * `insetTop` = bande HAUTE du conteneur occupée par une surcouche flottante (barre de couche) : elle
 * appartient au client rect mais pas au champ RÉELLEMENT dégagé — une boîte qui y tombe est cachée à
 * l'œil, donc « non vue », et le centrage vise la bande restante.
 * PURE (aucun DOM) : c'est la loi de cadrage, testable telle quelle.
 */
export function centerScrollFor(
  box: ScrollBox,
  port: ScrollPort,
  insetTop = 0,
): { left: number; top: number } | null {
  const seen =
    box.left >= port.scrollLeft &&
    box.right <= port.scrollLeft + port.clientWidth &&
    box.top >= port.scrollTop + insetTop &&
    box.bottom <= port.scrollTop + port.clientHeight;
  if (seen) return null;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, Math.max(0, max)));
  return {
    left: clamp((box.left + box.right) / 2 - port.clientWidth / 2, port.scrollWidth - port.clientWidth),
    top: clamp((box.top + box.bottom) / 2 - (port.clientHeight + insetTop) / 2, port.scrollHeight - port.clientHeight),
  };
}

/** Amène `el` dans le champ de son conteneur défilable `port` — MÊME loi de cadrage que la carte
 *  (`centerScrollFor`), bornée à ce conteneur : rien d'autre ne défile. */
export function scrollElementIntoPort(el: HTMLElement, port: HTMLElement) {
  const b = el.getBoundingClientRect(),
    p = port.getBoundingClientRect();
  const left = b.left - p.left + port.scrollLeft,
    top = b.top - p.top + port.scrollTop;
  const next = centerScrollFor({ left, right: left + b.width, top, bottom: top + b.height }, port);
  if (!next) return;
  port.scrollLeft = next.left;
  port.scrollTop = next.top;
}

/**
 * Caméra de l'ÉDITEUR : rotation 90° (touches Q/E par POSITION physique e.code — A/E sur AZERTY),
 * zoom/pan via le `viewBox` (molette ancrée au curseur, clic-milieu / Espace + glisser).
 * `getScreenCTM` tient compte du viewBox → le picking est inchangé (zéro modif du placement).
 */
export function useEditorView() {
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0); // rotation caméra éditeur (snap, local)
  const [viewMode, setViewMode] = useState<'iso' | 'top'>('top'); // projection éditeur (bascule, local) — plan par défaut : l'éditeur travaille le PLAN, l'iso juge le rendu (arbitrage user 2026-07-25)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // x,y = origine viewBox (coords contenu)
  const spaceRef = useRef(false); // barre Espace maintenue → pan au glisser
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  /** Conteneur DÉFILABLE du canevas (`.editor-canvas-wrap`) : la carte y est plus haute que la fenêtre. */
  const wrapRef = useRef<HTMLElement>(null);
  /** Taille du canvas (dépend de la scène ET de `rot`) — synchronisée par le composant à chaque rendu. */
  const stageRef = useRef({ w: 0, h: 0 });
  /** Surcouche FLOTTANTE posée en haut du conteneur (barre de couche) : elle recouvre le champ sans
   *  le réduire. Le composant l'attache ; sa géométrie RÉELLE donne la marge de sécurité du cadrage. */
  const topOverlayRef = useRef<HTMLElement | null>(null);

  // Rotation au clavier (hors champ de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      // e.code = POSITION physique (indépendant AZERTY/QWERTY) : rotation sur les touches au même
      // endroit que Q/E sur QWERTY — soit A/E sur AZERTY.
      if (e.code === 'KeyE') setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3));
      else if (e.code === 'KeyQ') setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Borne BASSE sous 1 : une carte plus haute que la fenêtre (32×38 cases) doit pouvoir tenir à l'écran
  // d'un bloc — à 1, « Zoom arrière » n'avait aucun effet depuis l'état initial.
  const ZE_MIN = 0.25,
    ZE_MAX = 6;
  // Zoom centré sur un point contenu (curseur pour la molette, centre pour les boutons).
  const zoomAt = (factor: number, ax?: number, ay?: number) =>
    setView((v) => {
      const nz = Math.min(ZE_MAX, Math.max(ZE_MIN, v.zoom * factor));
      const s = stageRef.current;
      const ovw = s.w / v.zoom,
        ovh = s.h / v.zoom;
      const nvw = s.w / nz,
        nvh = s.h / nz;
      const cx = ax ?? v.x + ovw / 2,
        cy = ay ?? v.y + ovh / 2;
      const fx = (cx - v.x) / ovw,
        fy = (cy - v.y) / ovh;
      return { zoom: nz, x: cx - fx * nvw, y: cy - fy * nvh };
    });

  // Molette = zoom ancré sur le curseur (listener non-passif pour preventDefault).
  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, loc.x, loc.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Barre Espace maintenue → mode pan (au glisser).
  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = true;
    };
    const u = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', d);
    window.addEventListener('keyup', u);
    return () => {
      window.removeEventListener('keydown', d);
      window.removeEventListener('keyup', u);
    };
  }, []);

  /**
   * Amène les cases visées AU CENTRE du conteneur défilable (mise en évidence d'un défaut de plan) —
   * sans rien bouger si elles y sont déjà entières (`centerScrollFor`). La boîte se calcule par la
   * géométrie PARTAGÉE (`diamondCorners`) : correcte en plan comme en iso, quelle que soit la rotation.
   */
  const scrollTilesIntoView = (tiles: readonly { x: number; y: number; z: number }[], dims: Dims) => {
    const svg = canvasRef.current,
      wrap = wrapRef.current;
    if (!svg || !wrap || !tiles.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const t of tiles) {
      const c = diamondCorners(t.x, t.y, dims, t.z);
      for (const [px, py] of [c.top, c.right, c.bot, c.left]) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    const vbw = stageRef.current.w / view.zoom,
      vbh = stageRef.current.h / view.zoom;
    if (!vbw || !vbh) return;
    // Facteur contenu→pixel MESURÉ sur le rendu : le SVG est en plus mis à l'échelle par la CSS
    // (`.editor-iso { max-width: 100% }`), le zoom seul ne le donne pas.
    const svgBox = svg.getBoundingClientRect(),
      wrapBox = wrap.getBoundingClientRect();
    const sx = svgBox.width / vbw,
      sy = svgBox.height / vbh;
    const ox = svgBox.left - wrapBox.left + wrap.scrollLeft,
      oy = svgBox.top - wrapBox.top + wrap.scrollTop;
    // Bande haute recouverte par la surcouche flottante, MESURÉE sur elle (absente = aucune marge).
    const overlay = topOverlayRef.current?.getBoundingClientRect();
    const insetTop = overlay ? Math.max(0, overlay.bottom - wrapBox.top) : 0;
    const next = centerScrollFor(
      {
        left: ox + (minX - view.x) * sx,
        right: ox + (maxX - view.x) * sx,
        top: oy + (minY - view.y) * sy,
        bottom: oy + (maxY - view.y) * sy,
      },
      wrap,
      insetTop,
    );
    if (!next) return;
    wrap.scrollLeft = next.left;
    wrap.scrollTop = next.top;
  };

  return { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, scrollTilesIntoView, spaceRef, panRef, canvasRef, wrapRef, stageRef, topOverlayRef };
}
