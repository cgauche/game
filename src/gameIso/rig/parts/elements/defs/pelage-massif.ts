import type { AppearanceElement } from '../types';
import { furPatch } from '../../textures';
export const element: AppearanceElement = {
  key: 'pelage-massif', label: 'Pelage massif', category: 'trait',
  overlays: [
    { bone: 'torse', svg: furPatch(-8, 8, -20, 12, 3.4), scale: 'bone' },
    { bone: 'epauleG', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
    { bone: 'epauleD', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
  ],
};
