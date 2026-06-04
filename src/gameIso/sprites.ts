/**
 * Bibliothèque de sprites SVG (style validé) pour le rendu iso du jeu.
 * Chaque sprite est dessiné dans une boîte locale 120×150, pieds en (60,150).
 * placeSprite() le positionne sur une tuile. DEFS regroupe tous les dégradés.
 */
import { Combatant } from '../engine/types';
import { TW, TH, tileCenter, Dims } from './iso';
import creatureSprites from './creatureSprites.json';
import { propSvg } from './catalog/decor';
import { composeAppearance, hashSeed, type AppearancePins } from './appearance';

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

// --- Héros (poses debout) -------------------------------------------------
function soldier() {
  return `<g class="bob"><path d="M40 72 Q60 60 80 72 Q90 110 80 150 L60 140 L40 150 Q30 110 40 72 Z" fill="url(#g_cloak)"/>
    <rect x="50" y="118" width="9" height="30" fill="#3a2c22"/><rect x="61" y="118" width="9" height="30" fill="#46362a"/>
    <path d="M44 70 Q60 58 76 70 L80 116 Q60 126 40 116 Z" fill="url(#g_steel)" stroke="#3a4150" stroke-width="1.5"/>
    <path d="M60 70 L60 116" stroke="#5a6478" stroke-width="1.4"/>
    <path d="M42 74 Q26 88 28 112" stroke="url(#g_steelD)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <circle cx="26" cy="112" r="18" fill="#8a4030" stroke="#d8a93b" stroke-width="3"/><circle cx="26" cy="112" r="5" fill="#d8a93b"/>
    <path d="M78 74 Q94 80 92 50" stroke="#9aa6b8" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="89" y="14" width="6" height="38" rx="2" fill="url(#g_steel)" transform="rotate(8 92 33)"/>
    <ellipse cx="44" cy="70" rx="12" ry="8" fill="url(#g_steelD)"/><ellipse cx="76" cy="70" rx="12" ry="8" fill="url(#g_steelD)"/>
    <circle cx="60" cy="48" r="14" fill="#e2b48c"/>
    <path d="M46 46 Q60 26 74 46 L74 38 Q60 24 46 38 Z" fill="url(#g_steel)" stroke="#3a4150"/>
    <rect x="58" y="40" width="4" height="18" rx="2" fill="#7a8496"/>${e(55, 49, 1.6)}${e(65, 49, 1.6)}</g>`;
}
function slayer() {
  return `<g class="bob"><path d="M44 96 L38 148 L56 148 L58 100 Z" fill="#5a3f28"/><path d="M70 96 L78 148 L60 148 L60 100 Z" fill="#4c3520"/>
    <path d="M36 150 h22 l2 6 h-26z" fill="#241a12"/><path d="M80 150 h-22 l-2 6 h26z" fill="#1c140e"/>
    <path d="M40 80 Q60 70 80 80 L84 100 Q60 108 36 100 Z" fill="#6b4a2b"/>
    <path d="M34 50 Q60 38 86 50 Q92 74 82 92 Q60 100 38 92 Q28 74 34 50 Z" fill="url(#g_flesh)"/>
    <path d="M46 58 q8 8 0 18 M74 58 q-8 8 0 18 M60 54 v34" stroke="#2f6db0" stroke-width="2.4" fill="none" opacity="0.85"/>
    <path d="M36 56 Q16 70 12 46" stroke="url(#g_flesh)" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M84 56 Q104 70 108 46" stroke="url(#g_flesh)" stroke-width="11" fill="none" stroke-linecap="round"/>
    <g transform="translate(6 18) rotate(-18)"><rect x="-2" y="0" width="4" height="40" fill="#4a2f17"/><path d="M-16 0 q16 -14 16 14 q-16 -2 -16 -14z" fill="url(#g_axe)" stroke="#2a3038"/></g>
    <g transform="translate(108 18) rotate(18) scale(-1,1)"><rect x="-2" y="0" width="4" height="40" fill="#4a2f17"/><path d="M-16 0 q16 -14 16 14 q-16 -2 -16 -14z" fill="url(#g_axe)" stroke="#2a3038"/></g>
    <circle cx="60" cy="34" r="15" fill="#f0c49a"/>
    <path d="M46 38 Q60 80 74 38 Q66 56 60 58 Q54 56 46 38 Z" fill="#c43f0a"/>
    <path d="M60 -2 Q55 18 60 22 Q65 18 60 -2 Z" fill="url(#g_crest)"/>
    <path d="M50 6 Q48 20 56 22 M70 6 Q72 20 64 22" stroke="url(#g_crest)" stroke-width="6" fill="none" stroke-linecap="round"/>${e(54, 34, 1.6)}${e(66, 34, 1.6)}</g>`;
}
function sorcier() {
  return `<g class="bob"><path d="M40 70 Q60 60 80 70 L98 150 L22 150 Z" fill="url(#g_robe)"/>
    <g fill="#cfe3ff" opacity="0.85"><circle cx="44" cy="112" r="1.6"/><circle cx="60" cy="130" r="2"/><circle cx="74" cy="118" r="1.6"/><circle cx="52" cy="142" r="1.6"/></g>
    <path d="M44 84 Q30 92 30 122" stroke="url(#g_robe)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="27" y="18" width="5" height="112" rx="2" fill="#6a4a2a"/>
    <circle class="glow" cx="29" cy="16" r="11" fill="url(#g_glow)"/><circle cx="29" cy="16" r="4.5" fill="#d6f7ff"/>
    <path d="M76 84 Q90 92 88 112" stroke="url(#g_robe)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M46 56 Q60 28 74 56 Q72 76 60 80 Q48 76 46 56 Z" fill="url(#g_robe)"/>
    <circle cx="60" cy="58" r="11" fill="#e2b48c"/><path d="M52 62 Q60 80 68 62 L66 78 Q60 86 54 78 Z" fill="#d8d8d8"/>${e(56, 57, 1.5)}${e(64, 57, 1.5)}</g>`;
}
function halfling() {
  return `<g class="bob"><ellipse cx="50" cy="148" rx="12" ry="6" fill="#c8a06a"/><ellipse cx="72" cy="148" rx="12" ry="6" fill="#b8905a"/>
    <rect x="46" y="120" width="12" height="26" rx="4" fill="#5a4630"/><rect x="62" y="120" width="12" height="26" rx="4" fill="#4c3a26"/>
    <ellipse cx="60" cy="104" rx="26" ry="24" fill="#d8c9a0"/>
    <path d="M40 92 Q60 84 80 92 L82 120 Q60 128 38 120 Z" fill="url(#g_hVest)"/>
    <path d="M40 96 Q28 104 30 116" stroke="#d8c9a0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M80 96 Q92 104 90 116" stroke="#d8c9a0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="88" y="98" width="3" height="18" fill="#cfd6df" transform="rotate(22 89 107)"/>
    <circle cx="60" cy="74" r="15" fill="#f0c8a0"/>
    <path d="M44 72 q-2 -20 16 -20 q18 0 16 20 q-7 -9 -16 -9 q-9 0 -16 9z" fill="#7a4a22"/>
    <circle cx="47" cy="72" r="4" fill="#7a4a22"/><circle cx="73" cy="72" r="4" fill="#7a4a22"/>${e(55, 74, 1.6)}${e(65, 74, 1.6)}</g>`;
}
function witchHunter() {
  return `<g class="bob"><path d="M44 72 Q60 64 76 72 L92 150 L28 150 Z" fill="url(#g_coat)"/>
    <rect x="50" y="120" width="9" height="30" fill="#1a140e"/><rect x="61" y="120" width="9" height="30" fill="#120e08"/>
    <path d="M46 70 Q60 62 74 70 L78 104 Q60 110 42 104 Z" fill="url(#g_coat)"/><path d="M54 70 L60 92 L66 70 Z" fill="#e8e4da"/>
    <rect x="42" y="100" width="36" height="6" fill="#3a2a18"/><path d="M60 106 l4 8 l-4 4 l-4 -4z" fill="#d8a93b"/>
    <path d="M46 78 Q30 86 32 108" stroke="url(#g_coat)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g transform="translate(24 104)"><rect x="-2" y="-3" width="20" height="6" rx="1" fill="#241a12"/><rect x="-7" y="0" width="9" height="11" rx="2" fill="#3a2a18"/><rect x="16" y="-2" width="9" height="4" fill="#4a4a52"/></g>
    <path d="M74 78 Q90 86 88 112" stroke="url(#g_coat)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <line x1="88" y1="112" x2="102" y2="150" stroke="#cfd6df" stroke-width="2"/>
    <circle cx="60" cy="56" r="12" fill="#e2b48c"/>
    <path d="M38 50 q22 -7 44 0 q-7 5 -22 5 q-15 0 -22 -5z" fill="#15120c"/><path d="M49 50 q11 -24 22 0 z" fill="#15120c"/>
    <rect x="55" y="39" width="10" height="3" fill="#d8a93b"/>${e(55, 56, 1.4)}${e(65, 56, 1.4)}</g>`;
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
const HERO_BY_CAREER: Record<string, () => string> = {
  Soldat: soldier,
  Tueur: slayer,
  Sorcier: sorcier,
  'Sorcier de village': sorcier,
  Voleur: halfling,
  Répurgateur: witchHunter,
};

export function heroSprite(c: Combatant): string {
  const byCareer = c.career && HERO_BY_CAREER[c.career];
  if (byCareer) return byCareer();
  if (c.species?.startsWith('Halfling')) return halfling();
  if (c.species === 'Nains') return slayer();
  return soldier();
}

const CREATURE_SPRITES = creatureSprites as Record<string, string>;
const CREATURE_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(CREATURE_SPRITES)) CREATURE_BY_NORM[k.toLowerCase()] = v;

/** Sprite d'une créature : apparence par calques si enrichie (seed + pins),
 *  sinon sprite monolithique du bestiaire, sinon mutant générique. */
export function enemySprite(label: string, seed = 0, pins?: AppearancePins): string {
  if (!label) return mutantStand();
  const composed = composeAppearance(label, seed, pins);
  if (composed != null) return composed;
  return CREATURE_SPRITES[label] ?? CREATURE_BY_NORM[label.toLowerCase()] ?? mutantStand();
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
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  switch (ent.kind) {
    case 'pnj':
      if (!ent.ref || ent.ref === 'Villageois') return pnjSprite();
      return enemySprite(ent.ref, seed, ent.appearance?.pins);
    case 'ennemi':
      return enemySprite(ent.ref ?? '', seed, ent.appearance?.pins);
    case 'objet':
      return objetSprite();
    case 'prop':
      return propSprite(ent.ref);
    default:
      return '';
  }
}
export function objetSprite(): string {
  return propSvg('caisse');
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
  <linearGradient id="g_coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#30303a"/><stop offset="100%" stop-color="#141419"/></linearGradient>
  <linearGradient id="g_hVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f7e3a"/><stop offset="100%" stop-color="#46521f"/></linearGradient>
  <linearGradient id="g_mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></linearGradient>
  <linearGradient id="g_mutD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></linearGradient>
  <linearGradient id="g_flesh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b88e"/><stop offset="100%" stop-color="#b07a52"/></linearGradient>
  <linearGradient id="g_crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#c43f0a"/></linearGradient>
  <linearGradient id="g_axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></linearGradient>
  <radialGradient id="g_eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialGradient>`;
