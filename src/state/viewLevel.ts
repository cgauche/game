/**
 * Niveau (étage z) AFFICHÉ — « un étage à la fois » : IsoStage ne rend QUE l'étage actif (les autres ne
 * sont pas dessinés). L'étage actif suit le groupe (ou le combattant actif). Ce module ne porte QUE
 * l'override DEBUG (devtool `__wfrp.viewLevel(z)`) : `null` = automatique (suit le groupe). Store externe
 * minimal (hors store Zustand : isolé, zéro couplage). Vit dans `state` (#161) —
 * le devtool (`state/devtools.ts`) le PILOTE, le rendu (`gameIso/stage/MondeDeCampagne.tsx`) le LIT.
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
