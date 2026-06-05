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
// Type distinct (porté d'ambush) : mutant REPTILIEN à écailles — museau allongé,
// crête dorsale, longue queue qui balaie le sol, épaulant une arbalète tenue À
// L'HORIZONTALE (visée vers la droite → lit « tireur », pas « pioche »). Vert
// olive assumé (Chaos), silhouette lisible. Œil via g_eye.
const mutantLezard = `<g class="bob">
  <path d="M50 110 Q30 120 14 138 Q8 146 17 150 Q22 143 33 137 Q48 129 60 120 Z" fill="#4a6234"/>
  <path d="M21 139 l-4 6 m9 -10 l-2 8 m9 -12 l0 8" stroke="#2f4a22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M50 100 L45 132 L39 150 L50 150 L56 130 L58 104 Z" fill="#3a4a2a"/>
  <path d="M70 100 L75 132 L81 150 L70 150 L64 130 L62 104 Z" fill="#33421f"/>
  <path d="M37 148 l-4 3 m4 -3 l0 4 m3 -4 l3 3" stroke="#2f4a22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M83 148 l4 3 m-4 -3 l0 4 m-3 -4 l-3 3" stroke="#2f4a22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M42 62 Q60 50 80 62 Q90 86 82 108 Q60 118 44 108 Q34 86 42 62 Z" fill="#5d7a42"/>
  <path d="M44 58 l-3 -9 l9 4 z M53 54 l-2 -10 l9 4 z M63 53 l0 -11 l8 5 z" fill="#445a30"/>
  <g stroke="#3a5226" stroke-width="1.4" opacity="0.6" fill="none"><path d="M50 74 q8 4 18 0 M48 86 q10 5 22 0 M50 98 q9 4 18 0"/></g>
  <g fill="#2f4a22" opacity="0.55"><circle cx="54" cy="80" r="2.4"/><circle cx="68" cy="84" r="2.4"/><circle cx="60" cy="100" r="2.4"/></g>
  <g transform="translate(56 82)">
    <rect x="-4" y="-5" width="52" height="9" rx="2" fill="#5a3a1c"/>
    <rect x="28" y="-4" width="9" height="7" fill="#33220f"/>
    <path d="M44 -23 Q58 0 44 23" fill="none" stroke="#2a1c12" stroke-width="6" stroke-linecap="round"/>
    <line x1="45" y1="-21" x2="45" y2="21" stroke="#d8cdb0" stroke-width="2.2"/>
    <line x1="44" y1="0" x2="-2" y2="0" stroke="#cfd6df" stroke-width="2.4"/>
    <path d="M44 0 l10 -4 l0 8 z" fill="#9aa6b8"/>
  </g>
  <ellipse cx="56" cy="82" rx="6" ry="5" fill="#5d7a42"/><ellipse cx="84" cy="80" rx="5" ry="4" fill="#506a38"/>
  <path d="M50 50 Q50 36 64 34 Q78 33 88 38 Q86 44 78 46 Q70 49 65 54 Q54 56 50 50 Z" fill="#5d7a42"/>
  <path d="M86 38 q9 1 14 6 q-5 4 -14 2 z" fill="#506a38"/>
  <line x1="80" y1="44" x2="99" y2="44" stroke="#2a3a18" stroke-width="1.5"/>
  <path d="M84 47 l4 3 m4 -5 l3 3" stroke="#e8e0c0" stroke-width="1" stroke-linecap="round"/>
  <path d="M52 42 l-4 -9 l8 2 z" fill="#445a30"/>
  <ellipse cx="64" cy="41" rx="3.2" ry="4" fill="url(#g_eye)"/><circle cx="64" cy="40" r="1.6" fill="#1a1a08"/>
</g>`;

// Type distinct : mutant à tête de CANIDÉ qui HURLE — torse net (épaules,
// taille), bras le long du corps, museau levé vers le ciel gueule grande ouverte,
// deux oreilles dressées en arrière. Silhouette « homme-loup » poilue brune.
const mutantChien = `<g class="bob">
  <path d="M50 104 Q45 128 46 150 L57 150 Q57 130 59 106 Z" fill="#4a3a22"/>
  <path d="M64 104 Q69 128 69 150 L80 150 Q78 130 75 106 Z" fill="#3e3019"/>
  <path d="M42 150 L59 150 L59 143 Q50 141 42 145 Z" fill="#2a2012"/>
  <path d="M65 150 L83 150 L83 144 Q74 141 65 146 Z" fill="#22190d"/>
  <path d="M48 56 Q44 48 50 44 Q60 38 62 50 Q64 38 74 44 Q80 48 76 56 Q86 64 86 84 Q86 100 76 108 Q60 114 48 108 Q38 100 38 84 Q38 64 48 56 Z" fill="#6e4a2c"/>
  <path d="M50 72 Q62 78 74 72 M50 84 Q62 90 74 84" stroke="#4a3018" stroke-width="1.8" fill="none" opacity="0.7"/>
  <path d="M62 60 L62 100" stroke="#4a3018" stroke-width="1.6" opacity="0.6"/>
  <path d="M44 60 Q34 72 36 96" stroke="#6e4a2c" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M36 96 l-3 6 m3 -6 l1 7 m2 -7 l4 5" stroke="#3a2614" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M80 60 Q90 72 88 96" stroke="#6e4a2c" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M88 96 l3 6 m-3 -6 l-1 7 m-2 -7 l-4 5" stroke="#3a2614" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M56 50 Q52 38 56 30 L66 30 Q70 38 66 50 Z" fill="#6e4a2c"/>
  <path d="M58 32 Q50 18 60 12 Q70 14 72 26 Q74 34 70 40 Q62 42 58 32 Z" fill="#6e4a2c"/>
  <path d="M60 22 Q50 18 44 22 Q50 30 60 30 Q66 28 60 22 Z" fill="#5a3a22"/>
  <path d="M48 24 Q44 28 47 33 Q53 31 56 27 Z" fill="#2a160f"/>
  <path d="M51 27 l2.5 3 m4 -4 l2.5 3 m4 -3 l2 3" stroke="#e8dcc8" stroke-width="1" stroke-linecap="round"/>
  <path d="M64 14 Q60 4 70 6 Q72 14 68 20 Z" fill="#5a3a22"/>
  <path d="M70 16 Q70 6 80 8 Q80 16 74 22 Z" fill="#4a2f1c"/>
  <circle cx="46" cy="22" r="2.4" fill="#1a0e06"/>
  <ellipse cx="60" cy="24" rx="2.2" ry="2.8" fill="url(#g_eye)"/><circle cx="60" cy="24" r="1.1" fill="#140a06"/>
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
  // Charognard quadrupède : créature NON-bipède → sprite monolithique dédié (les
  // mutants humanoïdes passent désormais par le rig + parts). Une seule forme.
  Charognard: {
    id: 'Charognard',
    layers: [{ slot: 'forme', variants: [mutantCharognard] }],
  },
};
