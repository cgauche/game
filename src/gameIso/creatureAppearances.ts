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

// — Mutant : carnation (#b85a30 vif / #caa885 clair) déclinée — JAMAIS de vert —
const mutant = sprites['Mutant'];
const mutantVariants = [
  mutant,
  tint(mutant, [['#b85a30', '#8a7468'], ['#caa885', '#b3a796']]), // cendré
  tint(mutant, [['#b85a30', '#b58a5e'], ['#caa885', '#d8c9a8']]), // blafard
  tint(mutant, [['#b85a30', '#7a3a1e'], ['#caa885', '#9a7a52']]), // sombre
];

export const CREATURE_APPEARANCES: Record<string, CreatureAppearance> = {
  Humain: { id: 'Humain', layers: [{ slot: 'tenue', variants: humainVariants }] },
  Mutant: { id: 'Mutant', layers: [{ slot: 'carnation', variants: mutantVariants }] },
};
