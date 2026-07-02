/**
 * Bibliothèque de sprites SVG (style validé) pour le rendu iso du jeu.
 * Chaque sprite est dessiné dans une boîte locale 120×150, pieds en (60,150).
 * placeSprite() le positionne sur une tuile. DEFS regroupe tous les dégradés.
 */
import { TW, TH, EDGE_W, EDGE_H, tileCenter, depth, diamondPath, billboardScale, isSquareView, Dims, type Rot } from './iso';
import { propSvg } from './catalog/decor';
import type { Dir8 } from '../state/dir8';
import { TERRAIN_DEFS } from '../state/terrain';
import { P } from './catalog/decorPalette';
import { ao } from './shade';
import { rigFxGradients } from './rig/fxGradients';

const e = (cx: number, cy: number, r = 2) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r + 1}" fill="url(#g_eye)"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55 + 0.4}" fill="${P.villageoisPupille}"/>`;

/**
 * Terrains à rendu « en relief » : un objet depth-trié dessiné AU-DESSUS du sol
 * plat (mur 3D, arbre billboard), par opposition aux terrains plats (herbe…).
 * Source UNIQUE pour le jeu (IsoStage) ET l'éditeur — fini les branches
 * `if (t === 'mur') … if (t === 'bois')` dupliquées à l'identique dans les deux.
 * Ajouter un terrain en relief = une entrée ici (plus de `switch` inline).
 * NB : métadonnée STRUCTURELLE (les valeurs portent des fonctions `render` = du code, pas de la
 * donnée éditable) — hors du catalogue visuel data-driven, à dessein.
 */
const TERRAIN_OVERLAYS: Record<string, { render: (x: number, y: number, dims: Dims) => string; depthBias: number }> = {
  mur: { render: (x, y, d) => wallBlock(x, y, d), depthBias: 0 },
  bois: { render: (x, y, d) => tree(x, y, d), depthBias: -0.1 },
};

/** Relief d'un terrain (mur/bois…) prêt à empiler avec sa profondeur, ou null si plat. */
export function terrainOverlay(id: string, x: number, y: number, dims: Dims): { d: number; html: string } | null {
  const ov = TERRAIN_OVERLAYS[id];
  return ov ? { d: depth(x, y, dims) + ov.depthBias, html: ov.render(x, y, dims) } : null;
}

/** Ce terrain porte-t-il un overlay en relief ? Prédicat CAMERA-FREE du builder de props (`buildProps`
 *  émet l'élément ; le backend affine appelle `terrainOverlay` avec SA caméra pour le dessiner). */
export function terrainHasOverlay(id: string): boolean {
  return id in TERRAIN_OVERLAYS;
}

// Matériau du bloc de mur : une seule teinte bois-clair (torchis) déclinée en 3 niveaux de lumière
// (dessus éclairé · face gauche · face droite ombrée), tons de `decorPalette` — jamais un hex ici.
function wallBlock(x: number, y: number, dims: Dims): string {
  const { cx, cy } = tileCenter(x, y, dims);
  if (isSquareView(dims.view)) {
    // Grille carrée : un mur vu de dessus = un bloc plein sur sa case (pas d'extrusion iso, qui
    // dessinait des faces orientées en losange → murs « mal orientés » sur la grille carrée).
    return `<path d="${diamondPath(x, y, dims)}" fill="${P.boisMoyen25}" stroke="${ao(0.4)}" stroke-width="1"/>`;
  }
  if (dims.edge) {
    // Vue de FACE (edge-on) : bloc AXIS-ALIGNÉ (façade droite + dessus), pas le cube-iso losange.
    const hx = EDGE_W / 2, hy = EDGE_H / 2;
    const Hh = TH * 1.6; // même hauteur visuelle qu'en iso
    const yTop = cy + hy - Hh; // arête haute de la façade (= arête avant du dessus)
    return (
      `<polygon points="${cx - hx},${cy + hy} ${cx + hx},${cy + hy} ${cx + hx},${yTop} ${cx - hx},${yTop}" fill="${P.boisMoyen25}" stroke="${ao(0.3)}" stroke-width="0.7"/>` + // façade
      `<polygon points="${cx - hx},${cy - hy - Hh} ${cx + hx},${cy - hy - Hh} ${cx + hx},${yTop} ${cx - hx},${yTop}" fill="${P.boisClair10}" stroke="${ao(0.25)}"/>` // dessus
    );
  }
  const H = TH * 1.6;
  const top = `M${cx},${cy - TH / 2 - H} L${cx + TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx - TW / 2},${cy - H} Z`;
  const left = `M${cx - TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx},${cy + TH / 2} L${cx - TW / 2},${cy} Z`;
  const right = `M${cx + TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx},${cy + TH / 2} L${cx + TW / 2},${cy} Z`;
  return (
    `<path d="${left}" fill="${P.boisMoyen25}" stroke="${ao(0.3)}"/>` +
    `<path d="${right}" fill="${P.boisFonce52}" stroke="${ao(0.3)}"/>` +
    `<path d="${top}" fill="${P.boisClair10}" stroke="${ao(0.25)}"/>`
  );
}

function tree(x: number, y: number, dims: Dims): string {
  const { cx, cy } = tileCenter(x, y, dims);
  // Billboard : réduit en vue « de face » (edge-on) pour remplir SA tuile plus étroite (comme tout
  // token, cf. billboardScale) — sinon le feuillage déborde sur les voisins. En iso k=1 → identique.
  const k = billboardScale(dims);
  const footY = cy + (dims.edge && dims.view !== 'top' ? EDGE_H : TH) / 2;
  const sc = k !== 1 ? ` scale(${k})` : '';
  return `<ellipse cx="${cx}" cy="${cy + 2}" rx="${26 * k}" ry="${13 * k}" fill="${P.ombre}" opacity="0.3"/>
    <g transform="translate(${cx},${footY})${sc}">
      <rect x="-7" y="-34" width="14" height="40" rx="3" fill="${P.boisSombre2}"/>
      <path d="M0 -150 L40 -78 L14 -86 L46 -30 L-46 -30 L-14 -86 L-40 -78 Z" fill="${P.feuillageSombre11}"/>
      <path d="M0 -150 L40 -78 L14 -86 L46 -30 L0 -44 Z" fill="${P.feuillageSombre9}"/>
      <path d="M0 -120 L28 -70 L0 -80 Z" fill="${P.feuillageFonce22}" opacity="0.6"/>
    </g>`;
}

// --- PNJ / props / objets --------------------------------------------------
function villager() {
  return `<g class="bob"><path d="M44 80 Q60 70 76 80 L82 150 L38 150 Z" fill="${P.villageoisEtoffe}"/>
    <path d="M44 78 Q60 70 76 78 L80 110 Q60 118 40 110 Z" fill="${P.villageoisEtoffeClaire}"/>
    <path d="M44 82 Q32 92 34 112" stroke="${P.villageoisEtoffe}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M76 82 Q88 92 86 112" stroke="${P.villageoisEtoffe}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="56" r="14" fill="${P.villageoisPeau}"/>
    <path d="M46 52 Q60 36 74 52 Q70 44 60 44 Q50 44 46 52 Z" fill="${P.villageoisCheveux}"/>${e(55, 56, 1.6)}${e(65, 56, 1.6)}
    <path d="M54 64 q6 4 12 0" stroke="${P.villageoisBouche}" stroke-width="1.5" fill="none"/></g>`;
}

export function pnjSprite(): string {
  return villager();
}

/** Vue minimale d'une entité pour le rendu (type structurel : pas d'import scene). */
export interface EntityViz {
  kind: string;
  id: string;
  ref?: string;
  appearance?: { seed?: number };
  /** Orientation MONDE (Dir8, même repère que `SceneEntity.facing`) — un prop directionnel (sièges)
   *  la projette avec la caméra via `project()` ; les props symétriques l'ignorent. */
  facing?: Dir8;
}

/**
 * Sprite d'une entité de scène pour le backend SPRITE (pickBackend l.78). Après le passage de
 * tout le bestiaire au rig, ce backend ne sert plus que le DÉCOR (props → propSprite) ; les
 * personnages/pnj sont routés vers le rig EN AMONT et n'arrivent pas ici — on retombe sur le
 * villageois par sécurité. Partagé par IsoStage (jeu) et l'éditeur (WYSIWYG) — source unique.
 */
export function entitySprite(ent: EntityViz, camRot: Rot = 0): string {
  switch (ent.kind) {
    case 'prop':
      return propSprite(ent.ref, ent.facing, camRot);
    case 'personnage':
    case 'pnj':
      return pnjSprite();
    default:
      return '';
  }
}
export function propSprite(ref?: string, facing?: Dir8, camRot: Rot = 0): string {
  return propSvg(ref ?? 'tonneau', facing, camRot);
}

// --- Définitions partagées (dégradés) -------------------------------------
/** Dégradés de TERRAIN assemblés depuis le registre (`TerrainDef.stops`) — source unique avec
 *  chaque `defs/<id>.ts`. Plusieurs terrains peuvent partager un `gradient` id → on ne l'émet
 *  qu'une fois (dédup). Tous verticaux (x1=0 y1=0 x2=0 y2=1). */
const terrainGradients = (() => {
  const seen = new Set<string>();
  let out = '';
  for (const t of TERRAIN_DEFS) {
    if (seen.has(t.gradient)) continue;
    seen.add(t.gradient);
    const stops = t.stops.map((s) => `<stop offset="${s.off}" stop-color="${s.color}"/>`).join('');
    out += `\n  <linearGradient id="${t.gradient}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  }
  return out;
})();

/** DEFS globaux = dégradés de TERRAIN (données) + dégradés RIG/FX (`rig/fxGradients`, verbatim). */
export const DEFS = terrainGradients + rigFxGradients;
