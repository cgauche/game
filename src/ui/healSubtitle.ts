import { DIFFICULTY_LABELS, type Difficulty } from '../engine/types';

/**
 * Libellé « Guérison, <Difficulté> » du sous-titre d'un flux de soin (HealRollFlow) — dérivé de
 * `PendingHeal.difficulty` (jamais recodé en dur), même patron que `SurgeryRollFlow` (MedicModal.tsx).
 */
export function healSubtitleLabel(difficulty: Difficulty): string {
  return `Guérison, ${DIFFICULTY_LABELS[difficulty]}`;
}
