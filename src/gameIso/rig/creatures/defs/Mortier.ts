import type { CreatureDef } from '../types';

/**
 * MORTIER DE SIÈGE — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `mortier` : tube court pointé haut sur caisson bas.
 */
export const creature: CreatureDef = {
  label: 'Mortier',
  id: 'mortier',
  plan: 'engin',
};
