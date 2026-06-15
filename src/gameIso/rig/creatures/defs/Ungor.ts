import type { CreatureDef } from '../types';
import { OV_CORNES_VESTIGIALES } from '../../parts/monstrous';

// Ungor (LDB 83) : « cornes VESTIGIALES ou très courtes […] souvent chétifs et mal nourris
// par rapport à leurs frères aux plus grandes cornes » — moignons de cornes + carrure étiolée.
export const creature: CreatureDef = {
  name: 'Ungor',
  plan: 'biped',
  race: 'Homme-bête',
  perso: {
    gabarit: 'elance-voute', // chétif — perd la masse trapue du gor
    features: [{ bone: 'tete', svg: OV_CORNES_VESTIGIALES, layer: -2 }],
  },
};
