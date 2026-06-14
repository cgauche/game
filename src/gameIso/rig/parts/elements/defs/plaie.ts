import type { AppearanceElement } from '../types';
import { OV_PLAIE } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'plaie', label: 'Plaie ouverte', category: 'trait',
  overlays: [{ bone: 'torse', svg: OV_PLAIE, scale: 'bone', layer: 98 }],
};
