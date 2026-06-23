import type { AppearanceElement } from '../types';

// Œil unique : un seul œil cyclopéen centré au milieu du front, à la place des deux yeux
// (mutation Œil unique, EDOC). Os tête, face (un détail de visage disparaît de dos/profil).
const OEIL_UNIQUE = '<g data-mut="oeil-unique">'
  // grand globe blanc centré, plus haut que la ligne des yeux (front)
  + '<ellipse cx="0" cy="-1.5" rx="3.6" ry="3" fill="#f4efe0" stroke="#8a7a64" stroke-width="0.6"/>'
  // iris + pupille
  + '<circle cx="0" cy="-1.5" r="1.7" fill="#6a8a6a" stroke="#3a4a3a" stroke-width="0.4"/>'
  + '<circle cx="0" cy="-1.5" r="0.8" fill="#1a1410"/>'
  + '<circle cx="0.7" cy="-2.3" r="0.5" fill="#ffffff" opacity="0.85"/>'
  // arcade/paupière marquée au-dessus
  + '<path d="M-4 -4.6 Q0 -6.6 4 -4.6" stroke="#7a6450" stroke-width="0.6" fill="none"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'oeil-unique', label: 'Œil unique', category: 'mutation',
  overlays: [{ bone: 'tete', svg: OEIL_UNIQUE, view: 'front' }],
};
