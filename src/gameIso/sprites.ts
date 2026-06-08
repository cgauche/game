/**
 * Bibliothèque de sprites SVG (style validé) pour le rendu iso du jeu.
 * Chaque sprite est dessiné dans une boîte locale 120×150, pieds en (60,150).
 * placeSprite() le positionne sur une tuile. DEFS regroupe tous les dégradés.
 */
import { TW, TH, tileCenter, depth, Dims } from './iso';
import creatureSprites from './creatureSprites.json';
import creatureViews from './creatureViews.json';
import { propSvg } from './catalog/decor';

const e = (cx: number, cy: number, r = 2) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r + 1}" fill="url(#g_eye)"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55 + 0.4}" fill="#140a06"/>`;

/** Place un sprite (boîte 120×150, pieds en (60,150)) sur la tuile (x,y). */
export function placeSprite(inner: string, x: number, y: number, dims: Dims, scale = 0.62): string {
  const { cx, cy } = tileCenter(x, y, dims);
  const sh = `<ellipse cx="${cx}" cy="${cy + 3}" rx="${22 * scale + 4}" ry="${(22 * scale + 4) / 2}" fill="#000" opacity="0.33"/>`;
  return `${sh}<g transform="translate(${cx - 60 * scale},${cy + TH / 2 - 150 * scale}) scale(${scale})">${inner}</g>`;
}

// --- Tuiles & décor de terrain --------------------------------------------
// Présentation des terrains : pilotée par le catalogue (catalog/terrain.ts).
export { terrainGradient } from './catalog/terrain';

/**
 * Terrains à rendu « en relief » : un objet depth-trié dessiné AU-DESSUS du sol
 * plat (mur 3D, arbre billboard), par opposition aux terrains plats (herbe…).
 * Source UNIQUE pour le jeu (IsoStage) ET l'éditeur — fini les branches
 * `if (t === 'mur') … if (t === 'bois')` dupliquées à l'identique dans les deux.
 * Ajouter un terrain en relief = une entrée ici (plus de `switch` inline).
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

export function wallBlock(x: number, y: number, dims: Dims): string {
  const { cx, cy } = tileCenter(x, y, dims);
  const H = TH * 1.6;
  const top = `M${cx},${cy - TH / 2 - H} L${cx + TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx - TW / 2},${cy - H} Z`;
  const left = `M${cx - TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx},${cy + TH / 2} L${cx - TW / 2},${cy} Z`;
  const right = `M${cx + TW / 2},${cy - H} L${cx},${cy + TH / 2 - H} L${cx},${cy + TH / 2} L${cx + TW / 2},${cy} Z`;
  return (
    `<path d="${left}" fill="#9b8e72" stroke="rgba(0,0,0,0.3)"/>` +
    `<path d="${right}" fill="#776a52" stroke="rgba(0,0,0,0.3)"/>` +
    `<path d="${top}" fill="#cdbfa0" stroke="rgba(0,0,0,0.25)"/>`
  );
}

export function tree(x: number, y: number, dims: Dims): string {
  const { cx, cy } = tileCenter(x, y, dims);
  return `<ellipse cx="${cx}" cy="${cy + 2}" rx="26" ry="13" fill="#000" opacity="0.3"/>
    <g transform="translate(${cx},${cy + TH / 2})">
      <rect x="-7" y="-34" width="14" height="40" rx="3" fill="#4a3220"/>
      <path d="M0 -150 L40 -78 L14 -86 L46 -30 L-46 -30 L-14 -86 L-40 -78 Z" fill="#1d3d18"/>
      <path d="M0 -150 L40 -78 L14 -86 L46 -30 L0 -44 Z" fill="#2a5320"/>
      <path d="M0 -120 L28 -70 L0 -80 Z" fill="#327026" opacity="0.6"/>
    </g>`;
}

// --- PNJ / props / objets --------------------------------------------------
function villager() {
  return `<g class="bob"><path d="M44 80 Q60 70 76 80 L82 150 L38 150 Z" fill="#6a5a3a"/>
    <path d="M44 78 Q60 70 76 78 L80 110 Q60 118 40 110 Z" fill="#8a7048"/>
    <path d="M44 82 Q32 92 34 112" stroke="#6a5a3a" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M76 82 Q88 92 86 112" stroke="#6a5a3a" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="56" r="14" fill="#e2b48c"/>
    <path d="M46 52 Q60 36 74 52 Q70 44 60 44 Q50 44 46 52 Z" fill="#5a4427"/>${e(55, 56, 1.6)}${e(65, 56, 1.6)}
    <path d="M54 64 q6 4 12 0" stroke="#9a7a5a" stroke-width="1.5" fill="none"/></g>`;
}

// --- Mutants (pose debout pour le combat tactique) ------------------------
function mutantStand() {
  return `<g class="bob"><path d="M48 100 L42 150 L58 150 L60 104 Z" fill="url(#g_mutD)"/><path d="M74 100 L84 150 L66 150 L62 104 Z" fill="url(#g_mutD)"/>
    <path d="M42 96 L38 122 L52 114 L60 124 L70 114 L80 122 L76 96 Z" fill="#544c32"/>
    <path d="M30 92 Q26 50 60 46 Q98 44 96 86 Q92 108 62 112 Q40 112 30 92 Z" fill="url(#g_mut)"/>
    <g fill="#2a3c18" opacity="0.7"><ellipse cx="46" cy="64" rx="6" ry="4"/><ellipse cx="74" cy="58" rx="7" ry="5"/><ellipse cx="84" cy="80" rx="6" ry="4"/><ellipse cx="58" cy="88" rx="8" ry="5"/></g>
    <path d="M34 90 Q18 100 16 120" stroke="url(#g_mut)" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M16 120 l-4 10 m4 -10 l6 9" stroke="#cdd9a0" stroke-width="3" stroke-linecap="round"/>
    <path d="M92 88 Q110 100 110 122" stroke="url(#g_mut)" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M110 122 l-4 11 m4 -11 l8 8" stroke="#cdd9a0" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="60" cy="42" r="11" fill="url(#g_mut)"/>${e(56, 41, 2.2)}${e(64, 41, 2.2)}
    <path d="M53 48 q7 5 14 0" stroke="#2a160f" stroke-width="2" fill="none"/></g>`;
}

// --- Registre -------------------------------------------------------------
const CREATURE_SPRITES = creatureSprites as Record<string, string>;
const CREATURE_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(CREATURE_SPRITES)) CREATURE_BY_NORM[k.toLowerCase()] = v;

/** Sprite monolithique d'une créature du bestiaire (par nom, insensible casse), sinon mutant
 *  générique. Backend SPRITE uniquement (non-rig) : les humains/mutants passent par le rig. */
export function enemySprite(label: string): string {
  if (!label) return mutantStand();
  return CREATURE_SPRITES[label] ?? CREATURE_BY_NORM[label.toLowerCase()] ?? mutantStand();
}

// Vues directionnelles (dos/profil) générées pour les créatures non-humanoïdes (F2).
type CreatureViewSet = { back?: string; profile?: string };
const CREATURE_VIEWS = creatureViews as Record<string, CreatureViewSet>;
const CREATURE_VIEWS_BY_NORM: Record<string, CreatureViewSet> = {};
for (const [k, v] of Object.entries(CREATURE_VIEWS)) CREATURE_VIEWS_BY_NORM[k.toLowerCase()] = v;

/**
 * Sprite d'une créature pour une VUE donnée (front/back/profile). La vue de profil
 * est tournée à droite ; le miroir gauche/droite est appliqué par le rendu (token).
 * Repli sur le front si la vue directionnelle n'existe pas pour ce bestiaire.
 */
export function creatureView(label: string, view: 'front' | 'back' | 'profile'): string {
  if (view !== 'front' && label) {
    const v = CREATURE_VIEWS[label] ?? CREATURE_VIEWS_BY_NORM[label.toLowerCase()];
    const svg = v?.[view];
    if (svg) return svg;
  }
  return enemySprite(label);
}

export function pnjSprite(): string {
  return villager();
}

/** Noms d'apparence disponibles (clés du bestiaire) — pour le sélecteur éditeur. */
export function creatureNames(): string[] {
  return Object.keys(CREATURE_SPRITES);
}

/** Vue minimale d'une entité pour le rendu (type structurel : pas d'import scene). */
export interface EntityViz {
  kind: string;
  id: string;
  ref?: string;
  appearance?: { seed?: number; pins?: Record<string, number> };
}

/**
 * Sprite d'une entité de scène — apparence DÉCOUPLÉE du rôle. Un pnj peut
 * porter n'importe quelle apparence créature via `ref` (ex. un pigeon qui
 * donne une quête) ; sans `ref` (ou ref 'Villageois') il reste villageois.
 * Partagé par IsoStage (jeu) et l'éditeur (WYSIWYG) — source unique.
 */
export function entitySprite(ent: EntityViz): string {
  switch (ent.kind) {
    // 'personnage' = kind unifié ; 'pnj'/'ennemi' = anciennes valeurs (compat).
    case 'personnage':
    case 'pnj':
      if (!ent.ref || ent.ref === 'Villageois') return pnjSprite();
      return enemySprite(ent.ref);
    case 'ennemi':
      return enemySprite(ent.ref ?? '');
    case 'prop':
      return propSprite(ent.ref);
    default:
      return '';
  }
}
export function propSprite(ref?: string): string {
  return propSvg(ref ?? 'tonneau');
}

// --- Définitions partagées (dégradés) -------------------------------------
export const DEFS = `
  <linearGradient id="g_grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4d7a38"/><stop offset="100%" stop-color="#2f4d20"/></linearGradient>
  <linearGradient id="g_sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6b5d4f"/><stop offset="100%" stop-color="#52463a"/></linearGradient>
  <linearGradient id="g_route" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9a8358"/><stop offset="100%" stop-color="#7d6a45"/></linearGradient>
  <linearGradient id="g_plancher" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8a6638"/><stop offset="100%" stop-color="#6a4d28"/></linearGradient>
  <linearGradient id="g_porte" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a5a3a"/><stop offset="100%" stop-color="#5a3f24"/></linearGradient>
  <linearGradient id="g_eau" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2f5a8a"/><stop offset="100%" stop-color="#234a74"/></linearGradient>
  <linearGradient id="g_terre" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a5f3c"/><stop offset="100%" stop-color="#57452b"/></linearGradient>
  <linearGradient id="g_dalle" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a7a39d"/><stop offset="100%" stop-color="#7c7872"/></linearGradient>
  <linearGradient id="g_pave" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8f8d96"/><stop offset="100%" stop-color="#63616b"/></linearGradient>
  <linearGradient id="g_steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8edf5"/><stop offset="45%" stop-color="#9aa6b8"/><stop offset="100%" stop-color="#5a6376"/></linearGradient>
  <linearGradient id="g_steelD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b94a6"/><stop offset="100%" stop-color="#444b5a"/></linearGradient>
  <linearGradient id="g_cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8323a"/><stop offset="100%" stop-color="#5e1418"/></linearGradient>
  <linearGradient id="g_robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a3f7a"/><stop offset="100%" stop-color="#171a36"/></linearGradient>
  <radialGradient id="g_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf3ff"/><stop offset="55%" stop-color="#4ec3e0" stop-opacity="0.7"/><stop offset="100%" stop-color="#4ec3e0" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_arcane" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e7d8ff"/><stop offset="55%" stop-color="#8a5cf0" stop-opacity="0.72"/><stop offset="100%" stop-color="#6a3cd8" stop-opacity="0"/></radialGradient>
  <radialGradient id="g_divine" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff4c2"/><stop offset="55%" stop-color="#f0c24a" stop-opacity="0.72"/><stop offset="100%" stop-color="#caa030" stop-opacity="0"/></radialGradient>
  <linearGradient id="g_coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#30303a"/><stop offset="100%" stop-color="#141419"/></linearGradient>
  <linearGradient id="g_hVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f7e3a"/><stop offset="100%" stop-color="#46521f"/></linearGradient>
  <linearGradient id="g_mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></linearGradient>
  <linearGradient id="g_mutD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></linearGradient>
  <linearGradient id="g_flesh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b88e"/><stop offset="100%" stop-color="#b07a52"/></linearGradient>
  <linearGradient id="g_crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#c43f0a"/></linearGradient>
  <linearGradient id="g_axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></linearGradient>
  <radialGradient id="g_eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialGradient>
  <radialGradient id="g_blood" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#7e1212"/><stop offset="100%" stop-color="#360707"/></radialGradient>`;
