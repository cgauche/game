import type { CreatureDef } from '../types';

/**
 * BALISTE de rempart (ADE II 8) — engin de siège, rendu par le gabarit `engin` (corps statique,
 * pas une créature). Route l'apparence par l'id d'espèce `baliste` : toute entité dont
 * `appearance.species === 'baliste'` (emplacement servi, défenseur ou assaillant) reçoit cet art.
 */
export const creature: CreatureDef = {
  name: 'Baliste',
  id: 'baliste',
  plan: 'engin',
};
