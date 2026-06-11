import type { CreatureDef } from '../types';
import { OV_CORNES_GOR } from '../../parts/monstrous';

// Gor (LDB 83) : « tête et jambes d'un bouc, torse et bras d'un humain […] une GRANDE paire
// de cornes — les plus grandes sont les meilleures — trait qui les différencie des ungors ».
export const creature: CreatureDef = {
  name: 'Gor',
  plan: 'biped',
  matchPriority: 25, // avant le def Homme-bête générique (30)
  match: '\\bgors?\\b|bestigor',
  race: 'Homme-bête',
  perso: {
    features: [{ bone: 'tete', svg: OV_CORNES_GOR, layer: -2 }],
  },
};
