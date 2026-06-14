import type { AppearanceElement } from '../types';
import { OV_CORNES_TAUREAU } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'cornes-taureau', label: 'Cornes de taureau', category: 'trait',
  overlays: [{ bone: 'tete', svg: OV_CORNES_TAUREAU, scale: 'bone', layer: -2 }],
};
