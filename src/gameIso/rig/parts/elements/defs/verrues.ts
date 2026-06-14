import type { AppearanceElement } from '../types';
import { OV_VERRUES } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'verrues', label: 'Verrues', category: 'trait',
  overlays: [{ bone: 'torse', svg: OV_VERRUES, scale: 'bone', layer: 98 }],
};
