import { useEffect, useRef, useState } from 'react';

/**
 * Caméra de l'ÉDITEUR : rotation 90° (touches Q/E — la lettre, AZERTY comme QWERTY),
 * zoom/pan via le `viewBox` (molette ancrée au curseur, clic-milieu / Espace + glisser).
 * `getScreenCTM` tient compte du viewBox → le picking est inchangé (zéro modif du placement).
 */
export function useEditorView() {
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0); // rotation caméra éditeur (snap, local)
  const [viewMode, setViewMode] = useState<'iso' | 'top'>('iso'); // projection éditeur (bascule, local)
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // x,y = origine viewBox (coords contenu)
  const spaceRef = useRef(false); // barre Espace maintenue → pan au glisser
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  /** Taille du canvas (dépend de la scène ET de `rot`) — synchronisée par le composant à chaque rendu. */
  const stageRef = useRef({ w: 0, h: 0 });

  // Rotation au clavier (hors champ de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      const k = e.key.toLowerCase(); // la LETTRE → Q/E étiquetées (AZERTY comme QWERTY)
      if (k === 'e') setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3));
      else if (k === 'q') setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ZE_MIN = 1,
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

  return { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef };
}
