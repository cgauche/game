import type { AppearanceElement } from '../types';

// Suintement de pus MULTI-SITES sur la PEAU VISIBLE (la note RAW tire une Localisation au hasard,
// elle ne perce pas les vêtements) : tempe + menton + dos de main, chacun avec ses coulures jaune-vert.
const PUS_TETE = '<g data-mut="suintement-de-pus">'
  + '<ellipse cx="5" cy="2.6" rx="1.6" ry="2" fill="#7a1010"/><ellipse cx="5" cy="2.6" rx="0.8" ry="1.2" fill="#b03a2e"/>'
  + '<path d="M5.4 4.2 q0.3 2.2 -0.2 4" stroke="#b8b34a" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.9"/>'
  + '<circle cx="-3.4" cy="12.6" r="1.1" fill="#7a1010"/><circle cx="-3.4" cy="12.6" r="0.55" fill="#b03a2e"/>'
  + '<path d="M-3.2 13.6 q0.2 1.8 -0.2 3.2" stroke="#b8b34a" stroke-width="0.6" fill="none" stroke-linecap="round" opacity="0.9"/>'
  + '</g>';
const PUS_MAIN = '<g data-mut="suintement-de-pus">'
  + '<ellipse cx="0.4" cy="2.2" rx="1.4" ry="1.7" fill="#7a1010"/><ellipse cx="0.4" cy="2.2" rx="0.7" ry="1" fill="#b03a2e"/>'
  + '<path d="M0 3.6 q-0.2 2 0.3 3.6 M1.2 3.4 q0.3 1.6 0 3" stroke="#b8b34a" stroke-width="0.65" fill="none" stroke-linecap="round" opacity="0.9"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'suintement-de-pus', label: 'Suintement de pus', category: 'mutation',
  overlays: [
    { bone: 'tete', svg: PUS_TETE, view: 'front' },
    { bone: 'mainD', svg: PUS_MAIN },
  ],
};
