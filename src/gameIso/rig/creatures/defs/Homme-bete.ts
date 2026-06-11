import type { CreatureDef } from '../types';
import { OV_CORNES_GOR } from '../../parts/monstrous';

// Homme-bête GÉNÉRIQUE : silhouette de gor (« les plus courants » LDB 83) — grandes cornes.
// Les variantes nommées ont leur def dédié testé AVANT : Gor, Ungor, Chamane-Brey, Minotaure.
export const creature: CreatureDef = {
  name: "Homme-bête",
  plan: 'biped',
  matchPriority: 30,
  match: "homme.?bete|beastman",
  perso: {
    features: [{ bone: 'tete', svg: OV_CORNES_GOR, layer: -2 }],
  },
};
