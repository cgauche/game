import type { RollBreakdown } from '../engine/combat';
import { testBreakdown, testPending } from './breakdown';
import type { PendingRoll } from './RollLine';

/** Libellés des Traits psy ciblés (LDB 21) — partagé par les modales psy combat ET rencontre. */
export const CIBLE_LABEL: Record<string, { emoji: string; label: string }> = {
  animosite: { emoji: '😤', label: 'Animosité' },
  haine: { emoji: '😡', label: 'Haine' },
  prejuge: { emoji: '🙄', label: 'Préjugé' },
  amour: { emoji: '❤️', label: 'Amour' },
  camaraderie: { emoji: '🤝', label: 'Camaraderie' },
  phobie: { emoji: '🕷️', label: 'Phobie' },
};

/** Ligne de jet (RollLine) d'un Test de Calme : base = Sang-froid, cible effective, d100, DR. */
export function calmeBreakdown(base: number, r: { roll: number; target?: number; sl?: number; success?: boolean }): RollBreakdown {
  return testBreakdown('Sang-froid', base, r);
}

/** Ligne de jet EN ATTENTE (pré-jet) d'un Test de Calme — parité Attaque/Défense, dé/DR vides. */
export function calmePending(base: number, target?: number): PendingRoll {
  return testPending('Sang-froid', base, target);
}
