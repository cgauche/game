import type { Combatant } from '../engine/types';
import type { BattleState } from './store';
import { trampleTarget, canMove } from './store';
import { canTakeAction, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import { hasFreeWeaponAttack } from './combatManeuvers';
import { inBattleId } from './combatOrParty';

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
      .map((id) => inBattleId(battle, id))
      .filter((c): c is Combatant => !!c && !isOutOfAction(c));
    if (foes.length > 0 && active.advantage > Math.max(0, ...foes.map((f) => f.advantage))) return true;
  }
  // Piétinement GRATUIT (≥1 Avantage + cible adjacente plus petite, LDB 85) ?
  if (active.advantage >= 1 && !!trampleTarget(battle, active)) return true;
  // Attaque d'Arme GRATUITE accordée par un talent (Frénésie) encore disponible ce Round (LDB 21 l.34) ?
  if (hasFreeWeaponAttack(active)) return true;
  // Détermination : retirer un État (LDB 17 l.62-66) ?
  if ((active.resolve ?? 0) > 0 && active.conditions.length > 0) return true;
  return false;
}

/**
 * Ce combattant peut-il choisir d'AGIR EN PREMIER ce Round (pré-emption d'initiative, LDB ch.17 l.27 :
 * « Au début du Round, choisissez le moment où vous allez agir, sans tenir compte de l'Ordre
 * d'Initiative ») ? Affiché dans la frise d'initiative (InitiativeStrip) pendant la pause de début de Round.
 *
 * Aujourd'hui : un combattant avec ≥1 point de Chance (ou une arme Rapide), pas déjà en tête de l'ordre, et
 * toujours en état d'agir. Le CONTRÔLE (qui peut réordonner) est filtré par l'appelant (`controlsCombatant`).
 * Point d'extension pour les RÉORDONNANCEMENTS d'initiative (Chance, arme Rapide). Tir rapide n'est PAS un
 * réordonnancement (interruption hors de l'ordre, LDB 10) → il ne passe PAS par ici. Pur.
 */
export function canActFirst(c: Combatant, battle: BattleState): boolean {
  // ÉLIGIBILITÉ par RESSOURCE/position (Chance ou arme Rapide) — le `kind` n'est PAS un gate ici : le
  // CONTRÔLE (qui peut réordonner qui) est appliqué par l'appelant UI (`controlsCombatant`, CampaignView).
  if (isOutOfAction(c)) return false;
  if (battle.order[0] === c.id) return false; // déjà en tête de l'ordre du Round
  // Réordonnancement d'initiative : Chance (LDB ch.17 l.27) ou arme Rapide (LDB 62 l.318-319).
  return (c.fortune ?? 0) > 0 || canStrikeFirst(c.weapons);
}

/** Le RÉORDONNANCEMENT d'initiative est-il gratuit pour `c` ? (arme Rapide LDB 62 l.318-319 ; sinon il coûte
 *  1 point de Chance, LDB ch.17 l.27). Tir rapide (interruption hors de l'ordre, LDB 10) ne réordonne pas. */
export function freeActFirst(c: Combatant): boolean {
  return canStrikeFirst(c.weapons); // arme Rapide (LDB 62)
}
