import type { AppearanceElement } from '../types';
import { furPatch } from '../../textures';
export const element: AppearanceElement = {
  key: 'pelage', label: 'Pelage', category: 'trait',
  overlays: [
    { bone: 'torse', svg: furPatch(-7.5, 7.5, -19, 11, 3.2), scale: 'bone' },
    { bone: 'epauleG', svg: furPatch(-2.4, 2.4, 2, 24, 2.8), scale: 'bone' },
    { bone: 'epauleD', svg: furPatch(-2.4, 2.4, 2, 24, 2.8), scale: 'bone' },
  ],
};
