import type { CreatureAppearance } from './appearance';
import creatureSprites from './creatureSprites.json';

/** Apparences enrichies par calques. Les créatures absentes retombent sur
 *  le sprite monolithique de creatureSprites.json (cf. sprites.ts).
 *
 *  Stratégie v1 « variété sûre par construction » : on part du sprite redessiné
 *  (silhouette validée — barre qualité « silhouette d'abord, anti-blob-vert ») et
 *  on dérive des variantes par SWAP DE PALETTE. Même découpe, couleurs différentes
 *  → une foule paraît variée sans risque de dériver du style. Des variantes de pose
 *  (morphologie) viendront plus tard, avec retour visuel. */

const sprites = creatureSprites as Record<string, string>;

/** Recolore un sprite : remplace chaque couleur source par sa cible. */
function tint(base: string, pairs: [string, string][]): string {
  return pairs.reduce((acc, [from, to]) => acc.split(from).join(to), base);
}

// — Humain : tunique olive (#7a8a3a/#5c6a28) déclinée en 4 teintes —
const humain = sprites['Humain'];
const humainVariants = [
  humain,
  tint(humain, [['#7a8a3a', '#3a5a8a'], ['#5c6a28', '#2a4368']]), // bleu
  tint(humain, [['#7a8a3a', '#8a4a2a'], ['#5c6a28', '#5e2f18']]), // brun-roux
  tint(humain, [['#7a8a3a', '#6a6a72'], ['#5c6a28', '#44444e']]), // gris
];

// — Mutant : calque 'forme' = POOL de corps complets (recolors + morphologies
//   distinctes). Les calques se concatènent → une pose alternative doit être un
//   corps complet, pas un calque empilé. JAMAIS de vert (#mut / g_mut interdits). —
const mutant = sprites['Mutant'];
// Recolors de la forme debout (carnation), même silhouette validée.
const mutantDebout = [
  mutant,
  tint(mutant, [['#b85a30', '#8a7468'], ['#caa885', '#b3a796']]), // cendré
  tint(mutant, [['#b85a30', '#b58a5e'], ['#caa885', '#d8c9a8']]), // blafard
  tint(mutant, [['#b85a30', '#7a3a1e'], ['#caa885', '#9a7a52']]), // sombre
];
// Morphologie distincte : charognard quadrupède qui fouille au sol — haute croupe
// arrière, dos en pente, tête basse à l'avant, 4 membres + queue. Silhouette
// bête-à-quatre-pattes (vs l'humanoïde debout). Palette flesh, JAMAIS de vert.
const mutantCharognard = `<g class="bob">
  <path d="M98 108 q14 4 16 18 q-10 -2 -16 -10z" fill="url(#g_flesh)"/>
  <ellipse cx="80" cy="110" rx="22" ry="20" fill="url(#g_flesh)"/>
  <path d="M74 126 Q72 140 76 150 L84 150 Q86 138 86 126 Z" fill="#7a5232"/>
  <path d="M88 122 Q92 136 90 150 L98 150 Q98 134 96 120 Z" fill="url(#g_flesh)"/>
  <path d="M92 100 Q88 80 64 82 Q40 84 30 104 Q26 116 36 122 Q60 128 80 124 Q94 118 92 100 Z" fill="url(#g_flesh)"/>
  <path d="M44 90 q10 -8 22 -5 q14 1 20 9" stroke="#7a4a2e" stroke-width="2.2" fill="none" opacity="0.7"/>
  <ellipse cx="58" cy="88" rx="6" ry="4" fill="#8a3a1e" opacity="0.85"/><ellipse cx="72" cy="91" rx="5" ry="3.4" fill="#8a3a1e" opacity="0.85"/>
  <path d="M36 104 Q24 110 20 126 L30 128 Q34 114 44 110 Z" fill="url(#g_flesh)"/>
  <path d="M22 121 Q10 121 8 132 Q12 140 24 137 Q32 134 30 125 Z" fill="url(#g_flesh)"/>
  <path d="M8 132 Q1 132 0 138 Q6 141 12 137 Z" fill="#c98a64"/>
  <path d="M30 105 l3 -11 l6 10 z" fill="#caa885"/>
  <path d="M40 120 Q34 134 36 148 L44 148 Q44 134 48 122 Z" fill="#7a5232"/>
  <path d="M30 146 l-3 4 m3 -4 l1 5 m2 -5 l4 4" stroke="#c98a64" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="20" cy="129" rx="2.2" ry="1.7" fill="url(#g_eye)"/><circle cx="20" cy="129" r="1" fill="#140a06"/>
  <path d="M3 137 q7 3 13 1" stroke="#3a1c10" stroke-width="1.3" fill="none"/>
</g>`;

export const CREATURE_APPEARANCES: Record<string, CreatureAppearance> = {
  Humain: { id: 'Humain', layers: [{ slot: 'tenue', variants: humainVariants }] },
  Mutant: { id: 'Mutant', layers: [{ slot: 'forme', variants: [...mutantDebout, mutantCharognard] }] },
};
