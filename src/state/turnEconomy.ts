import type { Combatant } from '../engine/types';
import type { BattleState } from './store';
import { trampleTarget, canMove } from './store';
import { canTakeAction, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';

/**
 * Le héros actif a-t-il ENCORE une option UTILE ce tour ? (R6 du diagnostic lisibilité-combat). Sert au
 * garde-fou « tour gâché » et au surlignage « Fin du tour ». Réutilise EXACTEMENT les prédicats de
 * l'ActionBar (Action dispo · Mouvement restant · désengagement gratuit · Piétinement · attaque libre de
 * Frénésie · retrait d'État par Détermination) → une seule source de vérité. Pur.
 */
export function hasMeaningfulOption(active: Combatant, battle: BattleState): boolean {
  if (active.kind !== 'hero') return false;
  // Action encore disponible ET utilisable (Sonné/Brisé… gérés par canTakeAction) ?
  if (!battle.acted && canTakeAction(active)) return true;
  // Mouvement restant (décomposable, hors « Mouvement → Action → Mouvement ») ?
  if (canMove(battle, active)) return true;
  // Désengagement GRATUIT (Avantage strictement supérieur à tous les foes Engagés, LDB 15 l.87) ?
  if (isEngaged(active)) {
    const foes = (active.engagedWith ?? [])
      .map((id) => battle.combatants.find((c) => c.id === id))
      .filter((c): c is Combatant => !!c && !isOutOfAction(c));
    if (foes.length > 0 && active.advantage > Math.max(0, ...foes.map((f) => f.advantage))) return true;
  }
  // Piétinement GRATUIT (≥1 Avantage + cible adjacente plus petite, LDB 85) ?
  if (active.advantage >= 1 && !!trampleTarget(battle, active)) return true;
  // Attaque CC GRATUITE de Frénésie non encore utilisée ce Round (LDB 21 l.34) ?
  if (active.frenzied && !active.frenzyFreeUsed) return true;
  // Détermination : retirer un État (LDB 17 l.62-66) ?
  if ((active.resolve ?? 0) > 0 && active.conditions.length > 0) return true;
  return false;
}

/**
 * Ce combattant peut-il choisir d'AGIR EN PREMIER ce Round (pré-emption d'initiative, LDB ch.17 l.27 :
 * « Au début du Round, choisissez le moment où vous allez agir, sans tenir compte de l'Ordre
 * d'Initiative ») ? Affiché dans la frise d'ordre (BattlePanel) pendant la pause de début de Round.
 *
 * Aujourd'hui : un héros avec ≥1 point de Chance, pas déjà en tête de l'ordre, et toujours en état d'agir.
 * Point d'extension UNIQUE pour de futurs Atouts/talents d'initiative (« Rapide », « Tir rapide »…) — toute
 * nouvelle condition d'agir-en-premier s'ajoute ICI plutôt que d'être dispersée dans l'UI. Pur.
 */
export function canActFirst(c: Combatant, battle: BattleState): boolean {
  if (c.kind !== 'hero' || isOutOfAction(c)) return false;
  if (battle.order[0] === c.id) return false; // déjà en tête de l'ordre du Round
  return (c.fortune ?? 0) > 0;
}
