import type { AppearanceElement } from '../types';

// Tête de mort : la chair a disparu, ne reste qu'un crâne nu décharné — orbites vides creusées,
// trou nasal, rangée de dents apparentes (mutation Tête de mort, EDOC). Os tête, face.
const TETE_DE_MORT = '<g data-mut="tete-de-mort">'
  // calotte du crâne (os clair recouvrant le haut du visage)
  + '<path d="M-7 0 Q-8 -12 0 -15 Q8 -12 7 0 Q6 6 4 8 L-4 8 Q-6 6 -7 0 Z" fill="#d8cdb0" stroke="#8a7a5c" stroke-width="0.6"/>'
  // orbites vides, noires et creuses
  + '<ellipse cx="-3.4" cy="-2" rx="2.3" ry="2.6" fill="#1a140e"/>'
  + '<ellipse cx="3.4" cy="-2" rx="2.3" ry="2.6" fill="#1a140e"/>'
  // pommettes saillantes (ombre sous les orbites)
  + '<path d="M-5.6 1 Q-3.4 2 -1.4 1 M5.6 1 Q3.4 2 1.4 1" stroke="#9a8a6a" stroke-width="0.4" fill="none" opacity="0.7"/>'
  // trou nasal en cœur inversé
  + '<path d="M0 3 L-1.4 7 Q0 8 1.4 7 Z" fill="#1a140e"/>'
  // mâchoire + dents apparentes
  + '<path d="M-4.6 9 Q0 11 4.6 9 L4.2 13 Q0 14.6 -4.2 13 Z" fill="#e6dcc2" stroke="#8a7a5c" stroke-width="0.5"/>'
  + '<path d="M-3.4 10 v3 M-1.8 10.4 v3 M0 10.6 v3 M1.8 10.4 v3 M3.4 10 v3" stroke="#8a7a5c" stroke-width="0.4"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-de-mort', label: 'Tête de mort', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE_DE_MORT, view: 'front' }],
};
