import type { CreatureDef } from '../types';

/**
 * CATAPULTE — engin de siège, rendu par le gabarit `engin` (corps statique, pas une créature).
 * Route l'apparence par l'id d'espèce `catapulte` : les trappings `catapulte-petite`/`-moyenne`/
 * `-grande` y pointent tous par leur `siegeRig`.
 */
export const creature: CreatureDef = {
  label: 'Catapulte',
  id: 'catapulte',
  plan: 'engin',
};
