import type { AppearanceElement } from '../types';

// Renflement articulaire + plis anguleux à mi-tibia.
const ARTICULATION = '<g data-mut="articulation-jambes">'
  + '<ellipse cx="0" cy="10" rx="2.6" ry="2" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-2.1 8.7 q2.1 1.3 4.2 0 M-2.1 11.3 q2.1 -1.3 4.2 0" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.7"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'articulation-supplementaire-aux-jambes', label: 'Articulation supplémentaire aux jambes',
  category: 'mutation',
  overlays: [{ bone: 'tibiaG', svg: ARTICULATION }, { bone: 'tibiaD', svg: ARTICULATION }],
};
