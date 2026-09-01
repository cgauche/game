import type { FacadeAppearanceDef } from '../../types';

export const facade: FacadeAppearanceDef = {
  id: 'chapelle',
  wallAppearance: 'mur-en-bois',
  wallFeatures: {},
  features: {
    belfry: { prop: 'clocheton', base: 'toit', liftM: -0.15 },
  },
};
