import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Homme-bête GÉNÉRIQUE : silhouette de gor (« les plus courants » LDB 83) — grandes cornes.
export const creature: CreatureDef = {
  label: "Homme-bête",
  id: "homme-bete",
  plan: 'biped',
  perso: {
    features: [appendageFeature('cornes-gor')],
  },
};
