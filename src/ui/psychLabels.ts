import type { RollBreakdown } from '../engine/combat';
import { testBreakdown, testPending } from './breakdown';
import type { PendingRoll } from './RollLine';

// CIBLE_LABEL vit désormais dans engine/psychology (accessible state + ui) ; re-exporté ici pour les
// imports existants des modales.
export { CIBLE_LABEL } from '../engine/psychology';

/** Ligne de jet (RollLine) d'un Test de Calme : base = Sang-froid, cible effective, d100, DR. */
export function calmeBreakdown(base: number, r: { roll: number; target?: number; sl?: number; success?: boolean }): RollBreakdown {
  return testBreakdown('Sang-froid', base, r);
}

/** Ligne de jet EN ATTENTE (pré-jet) d'un Test de Calme — parité Attaque/Défense, dé/DR vides. */
export function calmePending(base: number, target?: number): PendingRoll {
  return testPending('Sang-froid', base, target);
}
