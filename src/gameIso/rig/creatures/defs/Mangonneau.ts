import type { CreatureDef } from '../types';

/**
 * MANGONNEAU — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `mangonneau` : catapulte à torsion, châssis bas à roues.
 */
export const creature: CreatureDef = {
  label: 'Mangonneau',
  id: 'mangonneau',
  plan: 'engin',
};
