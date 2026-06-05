/**
 * État ENGAGÉ + bonus de Charge — Livre de base, « Combat » (13) et « Déplacement » (15).
 *
 * Engagé (13-Combat l.174-175) : « Quand vous attaquez un adversaire, ou que vous êtes
 * attaqué, en combat au Corps à corps, vous êtes Engagé. … Si vous n'attaquez pas l'autre
 * pendant un Round complet, vous n'êtes plus Engagé. » → relationnel, symétrique, purgé en
 * fin de Round si aucune attaque échangée. Tout vient de la Source (aucune invention).
 */
import { Combatant } from './types';

export function isEngaged(c: Combatant): boolean {
  return (c.engagedWith?.length ?? 0) > 0;
}

export function isEngagedWith(a: Combatant, bId: string): boolean {
  return !!a.engagedWith?.includes(bId);
}

/** Pose Engagé symétriquement ET marque le coup échangé ce Round (les deux côtés).
 *  Idempotent (LDB 13-Combat l.174-175). À appeler sur TOUTE attaque de mêlée résolue
 *  (touche ou non : « ou que vous êtes attaqué » l.174). */
export function engage(a: Combatant, b: Combatant): void {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    x.engagedWith ??= [];
    x.meleeThisRound ??= [];
    if (!x.engagedWith.includes(y.id)) x.engagedWith.push(y.id);
    if (!x.meleeThisRound.includes(y.id)) x.meleeThisRound.push(y.id);
  }
}

/** Retire le lien Engagé A↔B des deux côtés (désengagement réussi, ou cible hors d'action). */
export function disengageFrom(a: Combatant, b: Combatant): void {
  if (a.engagedWith) a.engagedWith = a.engagedWith.filter((id) => id !== b.id);
  if (b.engagedWith) b.engagedWith = b.engagedWith.filter((id) => id !== a.id);
}

/** Fin de Round : lève l'Engagement d'une paire si AUCUNE mêlée n'a été échangée ce Round
 *  (LDB 13-Combat l.175), puis vide meleeThisRound. Engagé étant symétrique, un coup dans
 *  UN sens rafraîchit la paire dans les DEUX. Lit un instantané AVANT de muter (sinon la
 *  mutation de A→B casserait la lecture B→A). Purge aussi tout lien vers un combattant
 *  hors d'action (Blessures ≤ 0). */
export function decayEngagement(all: Combatant[]): void {
  const fresh = new Map<string, Set<string>>(all.map((c) => [c.id, new Set(c.meleeThisRound ?? [])]));
  const alive = new Set(all.filter((c) => c.wounds.current > 0).map((c) => c.id));
  for (const c of all) {
    if (c.engagedWith?.length) {
      c.engagedWith = c.engagedWith.filter((id) => alive.has(id) && (fresh.get(c.id)?.has(id) || fresh.get(id)?.has(c.id)));
    }
    c.meleeThisRound = [];
  }
}

/**
 * Bonus d'Avantage d'une Charge, en CASES (distance manhattan départ→cible AVANT déplacement).
 * +1 base (LDB 13-Combat l.102) ; +1 additionnel si la cible était à « au moins une distance,
 * en mètres, égale à votre caractéristique de Mouvement » (15-Dépl l.77). 1 case = 2 m (l.55),
 * donc M mètres = M/2 cases → seuil = ceil(M/2) cases. Portée de Course = 2×Marche = 2M cases
 * (Tableau des Mouvements l.61-72). Hors de portée de Course, ou départ non distant, → 0.
 */
export function chargeAdvantage(movementCases: number, distFromCases: number): 0 | 1 | 2 {
  const M = movementCases;
  const courseTiles = M * 2; // Course = 2M cases
  const farThreshold = Math.ceil(M / 2); // M mètres = M/2 cases, arrondi supérieur (« au moins »)
  if (distFromCases < 1 || distFromCases > courseTiles) return 0;
  return distFromCases >= farThreshold ? 2 : 1;
}
