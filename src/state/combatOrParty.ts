/**
 * Base commune des actions JOUEUR qui valent EN COMBAT comme HORS COMBAT (soin, incantation,
 * Focalisation… et les futures actions hors combat). Le seul écart entre les deux contextes est
 * « dans quel ensemble vit l'acteur » : la file de combat (`battle.combatants`) ou le groupe (`party`).
 * On l'INFÈRE de `battle != null` plutôt que de stocker un drapeau par modale — une modale `pending*`
 * gèle toute autre action, donc le contexte ne peut pas changer pendant un flux (pas de combat qui
 * démarre/finit modale ouverte). Un seul point de vérité → moins de divergence entre actions.
 *
 * Patron d'une nouvelle action combat-ou-hors-combat :
 *   - ouverture : garder `if (battle) …` seulement si l'action est hors-combat-only (ex. `oocCastSpell`) ;
 *   - acteurs (lanceur/cible) : `actorIn(get(), id)` ;
 *   - re-rendu après mutation EN PLACE (Chance/Résilience) : `…touchActors(get())` dans le `set` ;
 *   - sortie : en combat → `battle.log` (+ conso de l'Action, `checkBattleOver`) ; hors combat → `journal`.
 *
 * Module-level : NON scanné par le garde-fou (qui n'inspecte que les actions du store).
 */
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Get } from './flowTypes';
import { currentTargetingMode } from './targetingModes';
import { hoverTargeting } from './targeting';

/** Acteur d'une action joueur résolu dans le bon ensemble : file de combat si en combat, sinon le groupe. */
export function actorIn(state: GameState, id: string): Combatant | undefined {
  return (state.battle?.combatants ?? state.party).find((c) => c.id === id);
}

/** Patch Zustand pour re-render après mutation EN PLACE d'un acteur (Chance/Résilience) : combat → `battle`, sinon `party`. */
export function touchActors(state: GameState): Partial<GameState> {
  return state.battle ? { battle: { ...state.battle } } : { party: [...state.party] };
}

/**
 * Cliquer un combattant — son TOKEN sur la carte OU son PORTRAIT dans la frise/dock — déclenche-t-il
 * une ACTION de combat plutôt qu'une simple inspection ? DÉRIVÉ du MODE de ciblage courant
 * (`targetingModes`) : « le mode courant cible des combattants ET `t` ∈ ses cibles » — un mode-CASE pur
 * (téléportation) ne cible aucun combattant ; un mode à liste (soin/Surincantation/Frappe Mortelle/2ᵉ
 * frappe) consulte ses `candidates` ; un mode à réticule (attaque/cast/bordée) consulte l'affordance
 * (≠ 'none') ; une pose de zone (commit sans affordance) agit sur la case de tout combattant cliqué.
 * Condition UNIQUE partagée par la carte (`IsoStage.performClick`), la frise (`onStripPortrait`) et le
 * curseur (`cursorCommitIntent`) — les surfaces ne peuvent plus diverger. L'autorisation COOP
 * (`controlsActive`) reste gardée par l'APPELANT.
 */
export function combatantClickActs(get: Get, combatant: Pick<Combatant, 'id'>): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return false;
  const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (!active) return false;
  const mode = currentTargetingMode(get);
  if (!mode.commitCombatant) return false; // mode-CASE pur (téléportation) : aucun combattant à cibler
  if (mode.candidates) return mode.candidates(get, active).some((c) => c.id === combatant.id);
  const target = battle.combatants.find((c) => c.id === combatant.id);
  if (!target) return false;
  // Mode à réticule (attaque/cast/bordée) : la cible est actionnable ⇔ son affordance ≠ 'none' (même
  // prédicat que le clic). Pose de zone (pas d'affordance, mais un commit) : tout combattant cliqué agit
  // (sa case sert d'ancre au gabarit).
  return mode.affordance ? hoverTargeting(get, active, target).kind !== 'none' : true;
}
