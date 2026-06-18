/**
 * Garde unique de reprise du combat — « une modale / une pause empêche-t-elle l'IA d'avancer ? ».
 *
 * Avant, quatre sites (`resumeEnemyTurn`, `resumeSuspendedAI`, `advanceTurn`, `maybeRunEnemyTurn`)
 * recopiaient — et DIVERGEAIENT sur — la même liste de `pending*` bloquants. Ce module en fait UNE
 * définition. Étape A1 : strictement ISO-comportement, les divergences historiques de chaque site
 * (surveille-t-il `pendingCast` ? `pendingRoundStart` ?) sont rendues explicites via `opts`. L'étape
 * A1-bis unifie ces divergences (dérivation depuis le registre `MODAL_DEFS`).
 *
 * Module FEUILLE (convention « baril ») : n'importe RIEN de `combatFlow` ; ré-exporté par lui.
 */
import type { ArbiterState } from './modalArbiter';
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { ownsLocally } from './netOwnership';
import { cadenceAutoCombat } from '../engine/cadence';

/**
 * Une modale de combat (ou la pause de Round) bloque-t-elle l'avancée/reprise de l'IA ?
 * `opts` reflète À L'IDENTIQUE ce que chaque garde historique surveillait :
 *  - `cast`       (défaut `true`)  : `resumeSuspendedAI` ne testait PAS `pendingCast`.
 *  - `roundStart` (défaut `false`) : seul `maybeRunEnemyTurn` testait `pendingRoundStart` ici
 *    (`advanceTurn` le fait par un `return` séparé en amont — comportement préservé côté appelant).
 */
export function combatAdvanceBlocked(
  s: ArbiterState,
  opts?: { cast?: boolean; roundStart?: boolean },
): boolean {
  if (!s.battle || s.battle.over) return true;
  if ((opts?.roundStart ?? false) && s.pendingRoundStart) return true;
  if ((opts?.cast ?? true) && s.pendingCast) return true;
  if (s.pendingFateSave || s.pendingFumble || s.pendingCascade || (s.pendingReveals?.length ?? 0) > 0) return true;
  return false;
}

/**
 * Le combattant `c` est-il piloté par l'IA ? — base AGNOSTIQUE AU CAMP de l'orchestrateur de tour.
 * Un ENNEMI l'est toujours (comportement inchangé). Un HÉROS l'est en mode Auto-combat ET s'il est
 * contrôlé LOCALEMENT (coop : on ne joue jamais le héros d'un autre siège). Un PNJ ne l'est jamais.
 * NB : `aiDriven` ne change PAS le `kind` du combattant — les règles indexées sur `kind` (Destin réservé
 * aux héros, Corruption, déviation d'armure, Mort Subite) restent CORRECTES : un héros auto-piloté
 * demeure un héros pour la résolution.
 */
export function aiDriven(s: GameState, c: Combatant): boolean {
  if (c.kind === 'enemy') return true;
  return c.kind === 'hero' && cadenceAutoCombat() && ownsLocally(s, c.id);
}
