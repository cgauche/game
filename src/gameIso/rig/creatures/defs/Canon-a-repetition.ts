import type { CreatureDef } from '../types';

/**
 * CANON À RÉPÉTITION — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `canon-a-repetition` (orgue à canons) : les variantes
 * « feu d'enfer » y pointent par leur `siegeRig`.
 */
export const creature: CreatureDef = {
  label: 'Canon à répétition',
  id: 'canon-a-repetition',
  plan: 'engin',
};
