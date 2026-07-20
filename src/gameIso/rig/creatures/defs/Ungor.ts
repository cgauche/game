import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Ungor (LDB 83) : « cornes VESTIGIALES ou très courtes […] souvent chétifs et mal nourris
// par rapport à leurs frères aux plus grandes cornes » — moignons de cornes + carrure étiolée.
export const creature: CreatureDef = {
  label: 'Ungor',
  plan: 'biped',
  race: 'Homme-bête',
  perso: {
    gabarit: 'elance-voute', // chétif — perd la masse trapue du gor
    features: [appendageFeature('cornes-vestigiales')],
  },
};
