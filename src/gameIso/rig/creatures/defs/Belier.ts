import type { CreatureDef } from '../types';

/**
 * BÉLIER DE SIÈGE — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `belier` : tronc suspendu à un portique roulant.
 */
export const creature: CreatureDef = {
  label: 'Bélier',
  id: 'belier',
  plan: 'engin',
};
