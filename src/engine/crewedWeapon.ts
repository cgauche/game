/**
 * ARME D'ÉQUIPE (Atout/Défaut *Arme d'équipe (Indice)*, AA / MDG ch.12 l.440-464) — mécanique PURE et
 * GÉNÉRALE : une pièce d'artillerie servie par une équipe, qu'elle soit emplacée au SOL (sièges) ou montée
 * sur un navire (poste). L'Indice (équipage requis) est lu sur la qualité `arme-d-equipe` de l'arme ; les
 * servants au-delà de l'Indice n'améliorent pas le tir mais compensent les pertes (l.444).
 */

/** Dégradation d'une Arme d'équipe en sous-effectif (cumulatif). */
export interface CrewedPenalty {
  /** Facteur du temps de recharge : 1 = normal, 2 = doublé (ne se cumule pas au-delà). */
  reloadFactor: 1 | 2;
  /** Défauts AJOUTÉS par le sous-effectif (ids de qualité), dans l'ordre d'aggravation. */
  addFlaws: ('imprecise' | 'dangereuse')[];
}

/**
 * Pénalité de sous-effectif d'une Arme d'équipe (MDG ch.12 l.448-460). `present` = nombre de servants,
 * `indice` = équipage requis (Indice de la qualité). CUMULATIF selon le déficit = max(0, indice − présents) :
 * ≥1 manquant → temps de recharge DOUBLÉ ; ≥2 → + Défaut *Imprécise* ; ≥3 → + Défaut *Dangereuse*. PUR.
 * (Le −10 supplémentaire si l'arme possède DÉJÀ le Défaut ajouté — l.460 — est appliqué à la résolution du
 * tir, qui connaît les qualités de base de l'arme.)
 */
export function crewedPenalty(present: number, indice: number): CrewedPenalty {
  const deficit = Math.max(0, indice - Math.max(0, present));
  const addFlaws: ('imprecise' | 'dangereuse')[] = [];
  if (deficit >= 2) addFlaws.push('imprecise');
  if (deficit >= 3) addFlaws.push('dangereuse');
  return { reloadFactor: deficit >= 1 ? 2 : 1, addFlaws };
}
