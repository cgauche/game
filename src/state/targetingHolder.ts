/**
 * QUI DÉTIENT le ciblage carte MAINTENANT (#1016) — SOURCE UNIQUE, consultée par les DEUX bouts du
 * clic : l'aiguilleur `targetingModes.currentTargetingMode` (quel mode rendre/commiter) et la
 * possession réseau `netOwnership.intentAllowedFor` (quel siège a le droit de cliquer).
 *
 * Module VOLONTAIREMENT LÉGER (aucun import runtime, le type de l'état seulement) : `netOwnership`
 * est importé par `combatFlow`, et `targetingModes` se déclare module FEUILLE du moteur de combat —
 * router le clic en important l'aiguilleur depuis `netOwnership` créerait le cycle
 * `netOwnership → targetingModes → combatFlow → netOwnership`. La dépendance va donc du LOURD vers
 * le LÉGER : l'aiguilleur consomme ce verdict, jamais l'inverse. La confrontation
 * verdict ⇄ mode réellement rendu est GARDÉE (`targeting-holder-vs-mode.test.ts`).
 */
import type { GameState } from './store';

/** Les `pending*` HORS-modale (`modalArbiter.HORS_MODAL`) qui peuvent tenir le ciblage carte —
 *  ÉNUMÉRATION RUNTIME (le type en dérive) : les gardes itèrent CETTE liste, jamais une copie. */
export const TARGETING_HOLDERS = ['pendingCleave', 'pendingDualStrike', 'pendingSiegeAim'] as const;
export type TargetingHolder = (typeof TARGETING_HOLDERS)[number];

/**
 * Le pending qui tient le ciblage, dans l'ORDRE de priorité de l'aiguilleur. `undefined` = ciblage
 * libre (attaque/sort/soin…) OU détenu par un pending du registre des MODALES (`pendingCast` :
 * Surincantation, pose de zone d'un sort) — la possession y reste celle de sa fenêtre, inchangée.
 */
export function targetingHolder(s: Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingAttack' | 'pendingCast' | 'pendingSiegeAim'>): TargetingHolder | undefined {
  if (s.pendingCleave && !s.pendingAttack) return 'pendingCleave';
  if (s.pendingDualStrike && !s.pendingAttack) return 'pendingDualStrike';
  if (s.pendingCast?.pickingTargets) return undefined;
  if (s.pendingCast?.zone?.placing && !s.pendingCast.zone.center) return undefined; // jumeau : combatFlow.placingZoneOf (source 'cast')
  if (s.pendingSiegeAim) return 'pendingSiegeAim';
  return undefined;
}
