/** Argmax GÉNÉRIQUE — l'élément maximisant `score`, tie-break = PREMIER maximum (strict `>`), source
 *  UNIQUE de ce tie-break dans le moteur. `null` si `items` vide. */
export function maxBy<T>(items: Iterable<T>, score: (t: T) => number): { item: T; value: number } | null {
  // Un seul passage : on ne remplace le meilleur courant que sur un score STRICTEMENT supérieur — les
  // ex æquo conservent donc l'élément rencontré EN PREMIER (invariant partagé par toutes les sélections
  // « le meilleur du groupe » du moteur : compétences, équipage, voyage…).
  let best: { item: T; value: number } | null = null;
  for (const item of items) {
    const value = score(item);
    if (!best || value > best.value) best = { item, value };
  }
  return best;
}
