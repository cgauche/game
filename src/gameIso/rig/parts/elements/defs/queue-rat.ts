import type { AppearanceElement } from '../types';
import { OV_QUEUE_RAT } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'queue-rat', label: 'Queue de rat', category: 'trait',
  overlays: [{ bone: 'bassin', svg: OV_QUEUE_RAT, scale: 'bone', layer: -2 }],
};
