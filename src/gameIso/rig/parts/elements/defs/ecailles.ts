import type { AppearanceElement } from '../types';
import { scalesPatch } from '../../textures';
export const element: AppearanceElement = {
  key: 'ecailles', label: 'Écailles', category: 'trait',
  overlays: [
    { bone: 'torse', svg: scalesPatch(-8, 8, -20, 12, 3), scale: 'bone' },
    { bone: 'epauleG', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
    { bone: 'epauleD', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
    { bone: 'cuisseG', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
    { bone: 'cuisseD', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
  ],
};
