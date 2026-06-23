/**
 * Paramètres du Test de RÉCUPÉRATION par ACTION d'un État (LDB 16 : Empêtré « se libérer » l.61 ;
 * En flammes « se rouler » l.77) — SOURCE UNIQUE lue de la DONNÉE (`EtatData.recover`), partagée par
 * l'IA (résolution inline, combatFlow) ET le flux joueur (`pendingStateRecovery`, combatSlice). Remplace
 * les branches par-nom `if state === empetre … else athletisme` dupliquées des deux côtés.
 */
import { type Combatant, type Difficulty, CHAR_LABELS } from '../../engine/types';
import { testValue } from '../../engine/skills';
import { isOutOfAction } from '../../engine/conditions';
import { findConditionById, refLabel } from '../../data';

export interface RecoverResolution {
  /** Libellé du Test (Compétence ou Caractéristique) — affiché en popin/journal. */
  skillLabel: string;
  /** Valeur de Test de l'acteur (Compétence `skill` ou Caractéristique `characteristic`). */
  skillValue: number;
  difficulty: Difficulty;
  /** Test OPPOSÉ (Empêtré contre la Force d'entrave) vs Test simple (En flammes). */
  opposed: boolean;
  /** Force d'entrave opposée : `escapeStrength` FIGÉE en priorité, sinon Force de la source vivante. */
  opponentValue?: number;
  opponentName?: string;
}

/**
 * Résout les paramètres du Test de récupération d'un État pour `actor` — depuis `EtatData.recover`.
 * `opposedBy:'source'` (Empêtré) : opposé contre la Force d'entrave — `escapeStrength` figée (vaut même
 * source absente, ex. FM du lanceur d'un Enchevêtrement) en PRIORITÉ, sinon Force de la source VIVANTE,
 * sinon Test simple. Renvoie `null` si l'État ne déclare pas de `recover` (non récupérable par Action).
 */
export function resolveRecoverTest(
  actor: Combatant, state: string, battle?: { combatants: Combatant[] },
): RecoverResolution | null {
  const rec = findConditionById(state)?.recover;
  if (!rec) return null;
  const skillValue = testValue(actor, rec.skill, rec.characteristic);
  const skillLabel = rec.skill ? refLabel('skills', { id: rec.skill }) : (rec.characteristic ? CHAR_LABELS[rec.characteristic] : 'Test');
  let opposed = false, opponentValue: number | undefined, opponentName: string | undefined;
  if (rec.opposedBy === 'source') {
    const cond = actor.conditions.find((c) => c.name === state);
    const src = cond?.sourceId && battle ? battle.combatants.find((c) => c.id === cond.sourceId && !isOutOfAction(c)) : undefined;
    if (cond?.escapeStrength != null) { opposed = true; opponentValue = cond.escapeStrength; opponentName = src?.name ?? 'l’entrave'; }
    else if (src) { opposed = true; opponentValue = testValue(src, undefined, 'F'); opponentName = src.name; }
  }
  return { skillValue, skillLabel, difficulty: rec.difficulty ?? 'intermediaire', opposed, opponentValue, opponentName };
}
