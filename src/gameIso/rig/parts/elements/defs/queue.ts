import type { AppearanceElement } from '../types';
import { OV_QUEUE } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'queue', label: 'Queue', category: 'trait',
  overlays: [{ bone: 'bassin', svg: OV_QUEUE, scale: 'bone', layer: -2 }],
};
