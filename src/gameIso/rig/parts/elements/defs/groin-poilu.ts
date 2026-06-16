import type { AppearanceElement } from '../types';

// Groin porcin rose, naseaux sombres, poils raides autour.
const GROIN = '<g data-mut="groin-poilu">'
  + '<ellipse cx="0" cy="8.5" rx="4" ry="3" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.6"/>'
  + '<ellipse cx="-1.3" cy="8.5" rx="0.8" ry="1.1" fill="#5a3a34"/><ellipse cx="1.3" cy="8.5" rx="0.8" ry="1.1" fill="#5a3a34"/>'
  + '<path d="M-4.6 6.4 q-1.4 -1 -2 -2.4 M-5 9 q-1.6 0 -2.8 -0.6 M4.6 6.4 q1.4 -1 2 -2.4 M5 9 q1.6 0 2.8 -0.6 M-2.6 4.6 q-0.6 -1.2 -0.4 -2.2 M2.6 4.6 q0.6 -1.2 0.4 -2.2" stroke="#241a12" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'groin-poilu', label: 'Groin poilu', category: 'mutation',
  overlays: [{ bone: 'tete', svg: GROIN, view: 'front' }],
};
