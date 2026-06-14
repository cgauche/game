import type { AppearanceElement } from '../types';

// Grande barbe nourrie ancrée à la mâchoire (Nain) — couleur @cheveux.
const BARBE_NAINE =
  '<g>'
  + '<path d="M-9 8 Q-12 24 -5 32 Q0 35 5 32 Q12 24 9 8 Q5 13 0 13 Q-5 13 -9 8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-5 15 Q0 18 5 15" fill="none" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-3 18 L-3 30 M3 18 L3 30" stroke="@cheveuxO" stroke-width="0.6" opacity="0.7"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'barbe-naine', label: 'Barbe naine', category: 'trait',
  overlays: [{ bone: 'tete', svg: BARBE_NAINE, scale: 'bone', layer: 10 }],
};
