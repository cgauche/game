/**
 * SPIKE WebGL — POLITIQUE DE VISIBILITÉ, UNIQUE et sans notion de caméra : une case VUE est pleine, une
 * case EXPLORÉE est assombrie, une case INCONNUE l'est davantage. Le backend affine porte la même
 * politique en filtres SVG (`FogLayer.tsx:23-24`, `fogFilterFor`) ; ici c'est un facteur multiplicatif
 * consommable par un matériau. La clé de case est celle de l'ancrage d'un `SceneEl` : `"x,y,z"`.
 */

/** Case actuellement vue : aucun voile en prod (`fogFilterFor` rend `undefined`). */
export const TINT_VISIBLE = 1;
/** Case déjà explorée, hors champ de vision. Prod : `brightness(.42) saturate(.45) opacity(.82)`
 *  (`FogLayer.tsx:23`). Un filtre CSS composé n'est pas un multiplicateur scalaire — 0.42 en est le
 *  terme `brightness`, la désaturation et l'opacité n'ont pas d'équivalent dans un facteur unique. */
export const TINT_EXPLORED = 0.42;
/** Case jamais vue. Prod : `brightness(0) opacity(.38)` (`FogLayer.tsx:24`) — un noir translucide sur
 *  le décor, approché ici par un facteur bas mais non nul (0 rendrait la silhouette illisible). */
export const TINT_UNKNOWN = 0.15;

/** Facteur de teinte d'une case (`"x,y,z"`) selon les ensembles vu / exploré. */
export function tintFor(key: string, visible: Set<string>, explored: Set<string>): number {
  if (visible.has(key)) return TINT_VISIBLE;
  return explored.has(key) ? TINT_EXPLORED : TINT_UNKNOWN;
}
