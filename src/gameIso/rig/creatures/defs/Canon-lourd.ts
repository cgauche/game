import type { CreatureDef } from '../types';

/**
 * CANON LOURD — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `canon-lourd` : les trappings « canon (moyen) », « canon
 * (grand) » et « canon » y pointent par leur `siegeRig` (le petit canon a son art propre).
 */
export const creature: CreatureDef = {
  label: 'Canon lourd',
  id: 'canon-lourd',
  plan: 'engin',
};
