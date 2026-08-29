import type { CreatureDef } from '../types';

/**
 * ONAGRE — engin de siège, rendu par le gabarit `engin` (corps statique).
 * Route l'apparence par l'id d'espèce `onagre` : bras de jet à fronde sur cadre-poutre sans roues.
 */
export const creature: CreatureDef = {
  label: 'Onagre',
  id: 'onagre',
  plan: 'engin',
};
