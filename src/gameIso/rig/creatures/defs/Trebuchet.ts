import type { CreatureDef } from '../types';

/**
 * TRÉBUCHET — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `trebuchet` : verge basculante à contrepoids sur cadre en A.
 */
export const creature: CreatureDef = {
  label: 'Trébuchet',
  id: 'trebuchet',
  plan: 'engin',
};
