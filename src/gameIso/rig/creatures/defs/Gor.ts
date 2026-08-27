import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Gor (LDB 83) : « tête et jambes d'un bouc, torse et bras d'un humain […] une GRANDE paire
// de cornes — les plus grandes sont les meilleures — trait qui les différencie des ungors ».
export const creature: CreatureDef = {
  label: 'Gor',
  id: "gor",
  plan: 'biped',
  race: 'homme-bete',
  perso: {
    features: [appendageFeature('cornes-gor')],
  },
};
