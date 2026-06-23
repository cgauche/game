import type { AppearanceElement } from '../types';

// Mauvais œil : un œil malveillant sur le visage, sclère injectée, iris difforme luisant d'une lueur
// verdâtre maléfique, pupille fendue inhumaine, sourcil tombant qui durcit le regard. Os tête, face,
// décalé sur l'œil gauche du visage.
const OEIL = '<g data-mut="mauvais-oeil">'
  // halo de lueur maléfique autour de l'œil
  + '<ellipse cx="-3" cy="-1" rx="4.2" ry="3.2" fill="#5aff8a" opacity="0.18"/>'
  // globe (sclère légèrement jaunie/injectée)
  + '<ellipse cx="-3" cy="-1" rx="2.9" ry="2.1" fill="#e8e2c4" stroke="#7a5a3a" stroke-width="0.5"/>'
  + '<path d="M-5.4 -2 q1.2 0.8 2.6 0.7 M-5.2 0 q1.4 0.6 2.6 0.4" stroke="#b04a3a" stroke-width="0.35" fill="none" opacity="0.7"/>'
  // iris vert luisant inhumain
  + '<circle cx="-3" cy="-1" r="1.6" fill="#3aa85a" stroke="#1c5a2e" stroke-width="0.4"/>'
  + '<circle cx="-3" cy="-1" r="1.6" fill="#7dff9c" opacity="0.3"/>'
  // pupille fendue verticale
  + '<path d="M-3 -2.4 Q-2.4 -1 -3 0.4 Q-3.6 -1 -3 -2.4 Z" fill="#100c08"/>'
  + '<circle cx="-3.5" cy="-1.6" r="0.45" fill="#dfffe6" opacity="0.85"/>'
  // sourcil dur / paupière supérieure tombante
  + '<path d="M-6 -3.6 Q-3 -4.6 0 -3" stroke="#3a2c1e" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'mauvais-oeil', label: 'Mauvais œil', category: 'mutation',
  overlays: [{ bone: 'tete', svg: OEIL, view: 'front' }],
};
