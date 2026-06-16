import type { AppearanceElement } from '../types';

// Halo doré diffus derrière la tête.
const HALO = '<g data-mut="beaute-surnaturelle">'
  + '<circle cx="0" cy="5" r="13" fill="#e8c860" opacity="0.3"/>'
  + '<circle cx="0" cy="5" r="13" fill="none" stroke="#e8c860" stroke-width="0.8" opacity="0.55"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'beaute-surnaturelle', label: 'Beauté surnaturelle', category: 'mutation',
  overlays: [{ bone: 'tete', svg: HALO, behind: true }],
};
