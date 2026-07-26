import type { FacadeAppearanceDef } from '../../types';

export const facade: FacadeAppearanceDef = {
  id: 'chapelle',
  wallAppearance: 'mur-en-bois',
  wallFeatures: {},
  features: {
    belfry: { prop: 'clocheton', liftM: 5 },
  },
};
