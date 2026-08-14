/**
 * CONTEXTE VOLUMIQUE REFUSÉ (#1176, P3-4, commit C5a) — le seul verdict « cette machine ne peut pas
 * peindre le monde ». Depuis la mort de la voie affine, l'échec de création du renderer n'a plus de
 * destination de repli : il se DIT au joueur (`stage/SansWebgl.tsx`), monté par les hôtes de monde à
 * la place de leur canevas.
 *
 * Hors store Zustand, même patron que `state/stage3d.ts` et `state/viewLevel.ts` : ce n'est pas une
 * donnée du monde et `snapshotSave` ne doit jamais l'emporter dans une sauvegarde. Le verdict est
 * LATCHÉ (une fois refusé, il le reste pour la session) : le contexte ne revient pas de lui-même, et
 * un hôte qui re-tenterait à chaque rendu boucherait la boucle de rendu d'échecs.
 */
let refusé = false;
const subs = new Set<() => void>();

export const webglRefusé = (): boolean => refusé;

/** Le renderer n'a pas pu être créé : les hôtes montent le message à la place du monde. */
export function signalerWebglRefusé(): void {
  if (refusé) return;
  refusé = true;
  subs.forEach((f) => f());
}

/** Remise à zéro — bancs de test uniquement (le jeu ne revient jamais d'un contexte refusé). */
export function reinitWebglRefusé(): void {
  refusé = false;
  subs.forEach((f) => f());
}

export function subscribeWebglRefusé(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
