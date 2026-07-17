import type { CreatureDef } from '../types';

/**
 * CANON de rempart / de siège (ADE II 8) — engin de siège, rendu par le gabarit `engin` (corps
 * statique). Route l'apparence par l'id d'espèce `canon-petit` (l'id du trapping servi) : tube de fonte
 * sur affût à roues, partagé par l'emplacement défenseur ET le canon des assaillants.
 */
export const creature: CreatureDef = {
  name: 'Canon de siège',
  id: 'canon-petit',
  plan: 'engin',
};
