/**
 * `hashSeed` — graine entière stable dérivée d'un id de token (variation déterministe du rig).
 *
 * Les apparences (humains, mutants modulaires) sont composées par le rig (`enemyProfile`/`composeRig` :
 * carrière, parts monstrueuses, couleurs, overlays de mutation), pas par swap de calques SVG.
 */

/** Hash FNV-1a 32 bits → graine entière stable pour un id de token. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
