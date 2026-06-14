import type { AppearanceElement } from '../types';
import { OV_CROCS } from '../../monstrous';
export const element: AppearanceElement = {
  key: 'crocs', label: 'Crocs', category: 'trait',
  overlays: [{ bone: 'tete', svg: OV_CROCS, scale: 'bone', layer: 98, view: 'front' }],
};
