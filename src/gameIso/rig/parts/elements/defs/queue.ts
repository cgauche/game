import type { AppearanceElement } from '../types';
export const element: AppearanceElement = {
  key: 'queue', label: 'Queue', category: 'trait',
  // queue MULTI-VUES du registre (id) — résolue par vue via pickView, comme partout.
  overlays: [{ bone: 'bassin', appendage: 'queue-generique', svg: '', scale: 'bone', layer: -2 }],
};
