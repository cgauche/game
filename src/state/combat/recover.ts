/**
 * Paramètres du Test de RÉCUPÉRATION par ACTION d'un État (LDB 16 : Empêtré « se libérer » l.66 ;
 * En flammes « se rouler » l.84) — SOURCE UNIQUE lue de la DONNÉE (`EtatData.recover`), partagée par
 * l'IA (résolution inline, combatFlow) ET le flux joueur (`pendingStateRecovery`, combatSlice). Remplace
 * les branches par-nom `if state === empetre … else athletisme` dupliquées des deux côtés.
 */
import { type Combatant, type Difficulty, CHAR_LABELS } from '../../engine/types';
import { testValue, skillBaseValue } from '../../engine/skills';
import { isOutOfAction } from '../../engine/conditions';
import { findConditionById, refLabel } from '../../data';

export interface RecoverResolution {
  /** Libellé du Test (Compétence ou Caractéristique) — affiché en popin/journal. */
  skillLabel: string;
  /** Valeur de Test de l'acteur (Compétence `skill` ou Caractéristique `characteristic`). */
  skillValue: number;
  /** Valeur NUE de l'acteur (`LDB 09 l.17`), grandeur du départage à DR égal (`LDB 12 l.160`). */
  skillBase: number;
  difficulty: Difficulty;
  /** Test OPPOSÉ (Empêtré contre la Force d'entrave) vs Test simple (En flammes). */
  opposed: boolean;
  /** Force d'entrave opposée : `escapeStrength` FIGÉE en priorité, sinon Force de la source vivante. */
  opponentValue?: number;
  /** Valeur NUE de l'entrave, pour le départage (`LDB 12 l.160`) : Force nue de la source vivante, ou
   *  la valeur FIGÉE elle-même (`escapeStrength` n'a aucun porteur — `charOf` résout sur la
   *  Caractéristique effective, `engine/ops.resolveFormula`). Posée avec `opponentValue`, jamais seule. */
  opponentBase?: number;
  opponentName?: string;
  /** Seuil de DR exigé sur un Test NON opposé (Filets, Zoo Impérial p.29) — `escapeThreshold` FIGÉE sur
   *  l'entrée d'État. Prioritaire sur `opposed`/`opponentValue` (mutuellement exclusifs). */
  requireSl?: number;
  /** Aggravation sur ÉCHEC (Filets, Zoo Impérial p.29 : « si la cible ne parvient pas à se dépêtrer, elle
   *  gagne un État Empêtré supplémentaire ») — `entangleOnFail` FIGÉE sur l'entrée d'État. */
  entangleOnFail?: boolean;
  /** Dégâts ignorant l'armure, à infliger à CHAQUE tentative de libération (réussie ou ratée) — Filets
   *  BARBELÉS, Zoo Impérial p.29 : `struggleDamage` FIGÉE sur l'entrée d'État. */
  struggleDamage?: number;
}

/**
 * Résout les paramètres du Test de récupération d'un État pour `actor` — depuis `EtatData.recover`.
 * `opposedBy:'source'` (Empêtré) : `escapeThreshold` figé (Filets, Zoo Impérial p.29 : Test NON opposé,
 * DR ≥ Indice du filet) en PRIORITÉ ; sinon `escapeStrength` figé (vaut même source absente, ex. FM du
 * lanceur d'un Enchevêtrement) → Test opposé ; sinon Force de la source VIVANTE → Test opposé ; sinon Test
 * simple. Renvoie `null` si l'État ne déclare pas de `recover` (non récupérable par Action).
 */
export function resolveRecoverTest(
  actor: Combatant, state: string, battle?: { combatants: Combatant[] },
): RecoverResolution | null {
  const rec = findConditionById(state)?.recover;
  if (!rec) return null;
  const skillValue = testValue(actor, rec.skill, rec.characteristic);
  const skillBase = skillBaseValue(actor, rec.skill, undefined, rec.characteristic);
  const skillLabel = rec.skill ? refLabel('skills', { id: rec.skill }) : (rec.characteristic ? CHAR_LABELS[rec.characteristic] : 'Test');
  let opposed = false, opponentValue: number | undefined, opponentBase: number | undefined;
  let opponentName: string | undefined, requireSl: number | undefined;
  let entangleOnFail: boolean | undefined, struggleDamage: number | undefined;
  if (rec.opposedBy === 'source') {
    const cond = actor.conditions.find((c) => c.id === state);
    const src = cond?.sourceId && battle ? battle.combatants.find((c) => c.id === cond.sourceId && !isOutOfAction(c)) : undefined;
    if (cond?.escapeThreshold != null) { requireSl = cond.escapeThreshold; }
    else if (cond?.escapeStrength != null) { opposed = true; opponentValue = cond.escapeStrength; opponentBase = cond.escapeStrength; opponentName = src?.label ?? 'l’entrave'; }
    else if (src) { opposed = true; opponentValue = testValue(src, undefined, 'force'); opponentBase = skillBaseValue(src, undefined, undefined, 'force'); opponentName = src.label; }
    entangleOnFail = cond?.entangleOnFail;
    struggleDamage = cond?.struggleDamage;
  }
  return { skillValue, skillBase, skillLabel, difficulty: rec.difficulty ?? 'intermediaire', opposed, opponentValue, opponentBase, opponentName, requireSl, entangleOnFail, struggleDamage };
}
