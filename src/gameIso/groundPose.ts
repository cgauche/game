/**
 * État AU SOL d'un combattant pour le RENDU (« au sol » ≠ debout) :
 *  - `corpse` : hors de combat OU Inconscient → effondré, ne bouge plus ;
 *  - `prone`  : À Terre (LDB 16 l.37) → couché mais CONSCIENT, à demi relevé sur un coude ;
 *  - `null`   : debout.
 * Pur — consommé par les deux moteurs (rig bipède ET gabarits de créature).
 */
import type { Combatant } from '../engine/types';
import { hasCondition, isOutOfAction } from '../engine/conditions';

export type GroundState = 'corpse' | 'prone' | null;

export function groundStateOf(c: Combatant): GroundState {
  if (!c.conditions) return null; // entité éparse (pas un combattant complet)
  if (c.wounds && isOutOfAction(c)) return 'corpse'; // mort / Inconscient / Mort Subite figurant
  if (hasCondition(c, 'À Terre')) return 'prone';
  return null;
}
