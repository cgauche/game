import type { CreatureDef } from '../types';

/**
 * PIERRIER — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `pierrier` : petit tube pivotant sur poteau à fourche.
 */
export const creature: CreatureDef = {
  label: 'Pierrier',
  id: 'pierrier',
  plan: 'engin',
};
