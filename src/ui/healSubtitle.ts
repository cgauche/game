import { DIFFICULTY_LABELS, type Difficulty } from '../engine/types';
import type { HealMode } from '../engine/healing';

/**
 * Libellé « Guérison, <Difficulté> » du sous-titre d'un flux de soin (HealRollFlow) — dérivé de
 * `PendingHeal.difficulty` (jamais recodé en dur), même patron que `SurgeryRollFlow` (MedicModal.tsx).
 */
export function healSubtitleLabel(difficulty: Difficulty): string {
  return `Guérison, ${DIFFICULTY_LABELS[difficulty]}`;
}

/**
 * Verbe (+ préposition) du sous-titre selon `PendingHeal.mode` — même patron que le verbe de
 * `SurgeryRollFlow` (« opère »/« rééduque »), mais pour `HealRollFlow` (wounds/bleed/trauma/ammo).
 * Affichage UI (pas du texte RAW) : vocabulaire libre, cohérent avec les titres de `HealModal.tsx`.
 */
export function healSubtitleVerb(mode: HealMode): string {
  switch (mode) {
    case 'wounds':
      return 'soigne';
    case 'bleed':
      return 'stoppe l’hémorragie de';
    case 'ammo':
      return 'retire une munition de';
    case 'trauma':
      return 'traite la déchirure de';
    default:
      return 'soigne';
  }
}
