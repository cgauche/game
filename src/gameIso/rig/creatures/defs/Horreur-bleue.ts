import type { CreatureDef } from '../types';
import { OV_TENTACULES_FLANC } from './Horreur-rose';

// Horreur bleue de Tzeentch (T1 ch.9, trait Dédoublement : une rose tuée → DEUX bleues) :
// même anatomie de gueule béante, chair BLEUE, nettement plus petite (B 9 vs 17) et hargneuse.
export const creature: CreatureDef = {
  name: 'Horreur bleue',
  plan: 'biped',
  perso: {
    tenue: 'Nu',
    gabarit: 'gremlin',
    scale: 0.8, // moitié moins massive que la rose
    monster: { tete: 'horreur', griffes: true },
    colors: { peau: '#4a78c8' }, // bleu vif
    features: [
      { bone: 'torse', svg: OV_TENTACULES_FLANC(1), scale: 'bone', layer: 60 },
    ],
  },
};
