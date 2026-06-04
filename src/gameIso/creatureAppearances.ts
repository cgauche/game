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
//   corps complet, pas un calque empilé. Le vert EST permis pour les mutants
//   (Chaos) tant que la silhouette est lisible — proscrit = le blob informe. —
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
// Type distinct (porté d'ambush) : mutant REPTILIEN à écailles, debout, épaulant
// une arbalète. Vert olive assumé (Chaos), silhouette lisible (reptilien + arme à
// distance). Œil via g_eye ; écailles en hex littéral.
const mutantLezard = `<g class="bob">
  <path d="M48 96 L44 150 L60 150 L60 100 Z" fill="#3a4a2a"/><path d="M72 96 L80 150 L62 150 L62 100 Z" fill="#33421f"/>
  <path d="M40 64 Q60 48 84 64 Q92 90 84 112 Q60 122 44 112 Q32 90 40 64 Z" fill="#5d7a42"/>
  <path d="M52 76 l-6 18 M70 72 l6 20 M60 94 l-4 16" stroke="#243a18" stroke-width="2" opacity="0.6" fill="none"/>
  <g fill="#2f4a22" opacity="0.6"><circle cx="52" cy="80" r="2.5"/><circle cx="70" cy="84" r="2.5"/><circle cx="60" cy="100" r="2.5"/></g>
  <path d="M82 78 Q92 90 86 100" stroke="#5d7a42" stroke-width="9" fill="none" stroke-linecap="round"/>
  <g transform="translate(86 100)">
    <rect x="-4" y="-94" width="8" height="98" rx="2" fill="#5a3a1c"/>
    <rect x="-4" y="-46" width="8" height="9" fill="#33220f"/>
    <path d="M-42 -86 Q0 -100 42 -86" fill="none" stroke="#2a1c12" stroke-width="6" stroke-linecap="round"/>
    <line x1="-40" y1="-85" x2="40" y2="-85" stroke="#d8cdb0" stroke-width="2.2"/>
    <line x1="0" y1="-85" x2="0" y2="-48" stroke="#cfd6df" stroke-width="2.6"/>
    <path d="M0 -85 l-4 9 l8 0 z" fill="#9aa6b8"/>
    <path d="M-6 4 q6 10 12 0" fill="none" stroke="#33220f" stroke-width="4"/>
  </g>
  <circle cx="62" cy="46" r="13" fill="#5d7a42"/>
  <ellipse cx="57" cy="45" rx="3" ry="4" fill="url(#g_eye)"/><circle cx="57" cy="45" r="1.5" fill="#1a1a08"/><ellipse cx="69" cy="45" rx="3" ry="4" fill="url(#g_eye)"/><circle cx="69" cy="45" r="1.5" fill="#1a1a08"/>
  <path d="M55 52 q8 5 14 0" stroke="#1a2410" stroke-width="2" fill="none"/>
  <g stroke="#243a18" stroke-width="1.4" opacity="0.7" fill="none"><path d="M55 40 l5 6 M68 40 l-3 7 M62 52 l3 6"/></g>
</g>`;

// Type distinct : mutant à tête de CANIDÉ qui hurle — museau levé, gueule
// ouverte, oreilles dressées, corps poilu brun. Silhouette « homme-bête ».
const mutantChien = `<g class="bob">
  <path d="M48 102 Q42 126 44 150 L56 150 Q56 128 58 104 Z" fill="#4a3a22"/><path d="M64 102 Q70 126 70 150 L82 150 Q80 128 76 104 Z" fill="#3e3019"/>
  <path d="M40 150 L58 150 L58 143 Q49 141 40 145 Z" fill="#2a2012"/><path d="M66 150 L86 150 L86 144 Q77 141 66 146 Z" fill="#22190d"/>
  <path d="M40 58 Q46 48 60 46 L78 46 Q90 50 90 64 Q92 86 84 104 Q60 112 38 104 Q34 82 40 58 Z" fill="#6e4a2c"/>
  <path d="M44 98 l3 9 m6 -8 l2 10 m6 -9 l3 9 m7 -10 l2 10 m6 -10 l3 9" stroke="#4a3018" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M42 64 Q30 76 32 98" stroke="#6e4a2c" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M32 98 l-3 6 m3 -6 l1 7 m2 -7 l4 5" stroke="#3a2614" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M88 64 Q100 76 98 98" stroke="#6e4a2c" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M98 98 l3 6 m-3 -6 l-1 7 m-2 -7 l-4 5" stroke="#3a2614" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M56 52 Q54 42 60 36 L70 38 Q72 48 66 54 Z" fill="#6e4a2c"/>
  <ellipse cx="62" cy="28" rx="11" ry="9" fill="#6e4a2c"/>
  <path d="M64 19 l2 -12 l8 8 z" fill="#6e4a2c"/><path d="M71 20 l6 -10 l6 9 z" fill="#5a3a22"/>
  <path d="M54 26 Q40 16 33 5 Q44 7 56 20 Q60 24 58 30 Z" fill="#5a3a22"/>
  <path d="M40 14 Q35 20 40 27 Q48 25 53 20 Z" fill="#2a160f"/>
  <circle cx="34" cy="6" r="2.6" fill="#1a0e06"/>
  <ellipse cx="60" cy="26" rx="2.2" ry="1.7" fill="url(#g_eye)"/><circle cx="60" cy="26" r="1" fill="#140a06"/>
  <path d="M42 16 l1.5 3 m4 -4 l1.5 3.5 m4 -3 l1.5 3" stroke="#e8dcc8" stroke-width="1" stroke-linecap="round"/>
</g>`;
// Type distinct : mutant à BRAS-TENTACULE asymétrique — un bras normal, un
// énorme membre charnu qui s'enroule vers le haut, ventouses. Silhouette tordue.
const mutantTentacule = `<g class="bob">
  <path d="M48 104 Q42 126 44 150 L56 150 Q56 128 58 106 Z" fill="#4a3a22"/><path d="M64 104 Q70 126 70 150 L82 150 Q80 128 76 106 Z" fill="#3e3019"/>
  <path d="M40 150 L58 150 L58 143 Q49 141 40 145 Z" fill="#2a2012"/><path d="M66 150 L86 150 L86 144 Q77 141 66 146 Z" fill="#22190d"/>
  <path d="M42 60 Q46 50 60 48 L76 48 Q88 52 88 66 Q90 88 82 106 Q60 114 40 106 Q36 84 42 60 Z" fill="url(#g_flesh)"/>
  <ellipse cx="54" cy="78" rx="5" ry="3.5" fill="#8a3a1e" opacity="0.8"/><ellipse cx="68" cy="88" rx="4" ry="3" fill="#8a3a1e" opacity="0.8"/>
  <path d="M44 66 Q34 78 36 98" stroke="url(#g_flesh)" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M36 98 q-3 6 -1 11 M40 98 q-2 6 0 11" stroke="#c98a64" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M82 64 Q110 58 114 36 Q116 20 104 18" fill="none" stroke="url(#g_flesh)" stroke-width="15" stroke-linecap="round"/>
  <path d="M104 18 Q98 10 102 2" fill="none" stroke="#c98a64" stroke-width="7" stroke-linecap="round"/>
  <circle cx="98" cy="44" r="2.4" fill="#8a3a1e"/><circle cx="107" cy="32" r="2.2" fill="#8a3a1e"/><circle cx="92" cy="55" r="2.4" fill="#8a3a1e"/>
  <path d="M52 44 Q48 30 58 26 Q64 24 70 28 Q76 36 70 46 Q72 54 60 54 Q50 52 52 44 Z" fill="url(#g_flesh)"/>
  <path d="M58 26 Q54 14 50 6 Q58 10 60 24 Z" fill="#caa885"/>
  <ellipse cx="58" cy="40" rx="3" ry="2.4" fill="url(#g_eye)"/><circle cx="58" cy="40" r="1.3" fill="#140a06"/>
  <ellipse cx="67" cy="41" rx="1.8" ry="1.5" fill="url(#g_eye)"/><circle cx="67" cy="41" r="0.8" fill="#140a06"/>
  <path d="M55 48 Q61 51 67 48" stroke="#3a1c10" stroke-width="1.2" fill="none"/>
</g>`;

export const CREATURE_APPEARANCES: Record<string, CreatureAppearance> = {
  Humain: { id: 'Humain', layers: [{ slot: 'tenue', variants: humainVariants }] },
  Mutant: {
    id: 'Mutant',
    layers: [{ slot: 'forme', variants: [...mutantDebout, mutantCharognard, mutantLezard, mutantChien, mutantTentacule] }],
  },
};
