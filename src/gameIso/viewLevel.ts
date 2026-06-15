/**
 * Niveau (étage z) mis en AVANT au rendu — « un étage à la fois » : l'étage actif est plein, les autres
 * en fantôme léger (on garde le repère vertical sans noyer la vue). En jeu, l'étage actif suit le groupe
 * (ou le combattant actif). Ce module ne porte QUE l'override DEBUG (devtool `__wfrp.viewLevel(z)`) :
 * `null` = automatique (suit le groupe). Store externe minimal (hors store Zustand : isolé, zéro couplage).
 */
let _viewZ: number | null = null;
const subs = new Set<() => void>();

export const getViewZ = (): number | null => _viewZ;
export function setViewZ(z: number | null): void {
  _viewZ = z;
  subs.forEach((f) => f());
}
export function subscribeViewZ(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Opacité d'un étage selon qu'il est l'étage ACTIF (plein) ou un autre (fantôme léger). */
export const GHOST_LEVEL_OPACITY = 0.14;
export const floorEmphasisOpacity = (z: number, activeZ: number): number => (z === activeZ ? 1 : GHOST_LEVEL_OPACITY);
