import type { CreatureDef } from '../types';
import { OV_CORNES_GOR } from '../../parts/monstrous';

// Homme-bête GÉNÉRIQUE : silhouette de gor (« les plus courants » LDB 83) — grandes cornes.
export const creature: CreatureDef = {
  name: "Homme-bête",
  plan: 'biped',
  perso: {
    features: [{ bone: 'tete', svg: OV_CORNES_GOR, layer: -2 }],
  },
};
