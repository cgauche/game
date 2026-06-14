import type { AppearanceElement } from '../types';
import { OV_GRIFFES } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'griffes', label: 'Griffes', category: 'trait',
  overlays: [
    { bone: 'mainG', svg: OV_GRIFFES, scale: 'bone', layer: 98 },
    { bone: 'mainD', svg: OV_GRIFFES, scale: 'bone', layer: 98 },
  ],
};
