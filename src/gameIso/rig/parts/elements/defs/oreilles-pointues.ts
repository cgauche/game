import type { AppearanceElement } from '../types';

// Oreilles pointues aux tempes (elfes) — tell de l'elfe, couleur @peau.
const OREILLES_POINTUES =
  '<g>'
  + '<path d="M-8 7 Q-15 4 -14 -3 Q-11 1 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M8 7 Q15 4 14 -3 Q11 1 7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'oreilles-pointues', label: 'Oreilles pointues', category: 'trait',
  overlays: [{ bone: 'tete', svg: OREILLES_POINTUES, scale: 'bone', layer: 3 }],
};
