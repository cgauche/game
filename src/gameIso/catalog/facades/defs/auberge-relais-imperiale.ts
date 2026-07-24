import type { FacadeAppearanceDef } from '../../types';

export const facade: FacadeAppearanceDef = {
  id: 'auberge-relais-imperiale',
  wallAppearance: 'mur-a-ossature-en-bois',
  features: {
    'window-band': { prop: 'applique-murale', liftM: 1.35, scale: 0.8 },
    'stone-entry': { prop: 'arche-ruine', scale: 1.1 },
    gable: { prop: 'arche-ruine', liftM: 1.8, scale: 1.15 },
    chimney: { prop: 'cheminee', liftM: 2.25 },
    sign: { prop: 'enseigne', liftM: 1.25 },
  },
};
