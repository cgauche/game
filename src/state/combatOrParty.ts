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
 * Module-level : NON scanné par le garde-fou « un jet = une modale » (qui n'inspecte que les actions du store).
 */
import type { Combatant } from '../engine/types';
import type { GameState } from './store';

/** Acteur d'une action joueur résolu dans le bon ensemble : file de combat si en combat, sinon le groupe. */
export function actorIn(state: GameState, id: string): Combatant | undefined {
  return (state.battle?.combatants ?? state.party).find((c) => c.id === id);
}

/** Patch Zustand pour re-render après mutation EN PLACE d'un acteur (Chance/Résilience) : combat → `battle`, sinon `party`. */
export function touchActors(state: GameState): Partial<GameState> {
  return state.battle ? { battle: { ...state.battle } } : { party: [...state.party] };
}
