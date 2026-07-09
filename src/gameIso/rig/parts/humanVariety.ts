import type { Palette } from '../palette';

/**
 * Variété COSMÉTIQUE déterministe des humains génériques (#223 : « seed + repli bruyant »). Un PNJ
 * humain sans apparence authorée (parts/colors) recevait la palette de race FIXE + un des 3 seuls
 * index de coiffure (`(seed>>2)%3` de resolveParts) → clones à l'écran. Dérivé du SEUL seed stable
 * (id d'entité), donc identique en exploration et en combat, stable pour les goldens et le multi.
 * Couleurs de base uniquement : les ombres/reflets (peauO/cheveuxH…) sont dérivés par buildTokenMap.
 */

// Teintes de peau plausibles (clair → sombre) — cosmétique pur, aucune règle.
const SKIN_TONES = ['#e8c3a0', '#cf9d72', '#b89060', '#9a6f4a', '#6f4a2f'];
// Teintes de cheveux plausibles (noir, brun, châtain, roux, blond, grisonnant).
const HAIR_TONES = ['#2b241f', '#5a4427', '#7a5234', '#8a4a26', '#b89152', '#9a938a'];

const pick = <T>(arr: T[], n: number): T => arr[((n % arr.length) + arr.length) % arr.length];

/** Palette de base (peau + cheveux) dérivée du seed — bandes indépendantes pour décorréler teintes. */
export function humanSeedColors(seed: number): Palette {
  return { peau: pick(SKIN_TONES, Math.floor(seed / 3)), cheveux: pick(HAIR_TONES, Math.floor(seed / 13)) };
}

/** Index de coiffure dérivé du seed sur TOUT le pool (cosmeticPart replie sur la taille réelle). */
export function humanSeedHairIndex(seed: number): number {
  return Math.abs(seed >> 5);
}
