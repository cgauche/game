import type { AppearanceElement } from '../types';

// Tête de sanglier : groin allongé et retroussé au bout, deux DÉFENSES recourbées vers le haut
// sortant de la gueule (l'indice fort), soies hérissées sur le crâne, petites oreilles pointues.
// Os tête, face.
const SANGLIER = '<g data-mut="tete-bestiale-sanglier">'
  // soies dressées sur le sommet du crâne
  + '<path d="M-3 -6 l-0.6 -3 M0 -6.5 l0 -3.4 M3 -6 l0.6 -3" stroke="#2e241a" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  // petites oreilles pointues
  + '<path d="M-5.6 -4 L-7.6 -9 L-3.6 -6 Z" fill="#4a3a28" stroke="#2e241a" stroke-width="0.6"/>'
  + '<path d="M5.6 -4 L7.6 -9 L3.6 -6 Z" fill="#4a3a28" stroke="#2e241a" stroke-width="0.6"/>'
  // crâne sombre poilu
  + '<path d="M-6 -3 Q-6.4 3 -3.4 5.6 L3.4 5.6 Q6.4 3 6 -3 Q3.4 -7 0 -7 Q-3.4 -7 -6 -3 Z" fill="#52402c" stroke="#2e241a" stroke-width="0.7"/>'
  // yeux petits
  + '<circle cx="-3" cy="-0.5" r="0.8" fill="#1a120c"/>'
  + '<circle cx="3" cy="-0.5" r="0.8" fill="#1a120c"/>'
  // groin allongé retroussé
  + '<path d="M-2.6 5 Q-3.4 11 -0 12.6 Q3.4 11 2.6 5 Z" fill="#6e5640" stroke="#3a2c1e" stroke-width="0.6"/>'
  + '<ellipse cx="-1.2" cy="11.4" rx="0.7" ry="1" fill="#241a12"/>'
  + '<ellipse cx="1.2" cy="11.4" rx="0.7" ry="1" fill="#241a12"/>'
  // défenses recourbées vers le HAUT
  + '<path d="M-2.4 10.4 Q-4.6 9 -4.4 6.4 Q-3.4 8.4 -1.8 9.2 Z" fill="#e6ddc6" stroke="#9a8a64" stroke-width="0.5"/>'
  + '<path d="M2.4 10.4 Q4.6 9 4.4 6.4 Q3.4 8.4 1.8 9.2 Z" fill="#e6ddc6" stroke="#9a8a64" stroke-width="0.5"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-sanglier', label: 'Tête bestiale (Sanglier)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: SANGLIER, view: 'front' }],
};
