import type { AppearanceElement } from '../types';

// Bec corné de rapace remplaçant nez+bouche : mandibule supérieure crochue jaune-corne à pointe
// recourbée, mandibule inférieure plus courte, narine sombre à la base. Os tête, face.
const BEC = '<g data-mut="bec">'
  // mandibule supérieure crochue (jaune-corne)
  + '<path d="M-3.6 4.4 Q0 3.6 3.6 4.4 Q3.4 8.8 1.2 11.6 Q-0.2 13.6 -1 11.4 Q0.6 10.4 0.7 8.2 Q-1.6 7.8 -3.6 6.8 Z" fill="#e0b24c" stroke="#9a6f20" stroke-width="0.6" stroke-linejoin="round"/>'
  // arête supérieure (ombre du dos du bec)
  + '<path d="M-3 4.6 Q0 4.1 3 4.6" stroke="#b88a2c" stroke-width="0.5" fill="none" opacity="0.7"/>'
  // mandibule inférieure plus courte
  + '<path d="M-2.4 7.4 Q0 8.6 2.2 7.6 Q1.4 9.6 0 10 Q-1.4 9.6 -2.4 7.4 Z" fill="#c89436" stroke="#8a6018" stroke-width="0.5" stroke-linejoin="round"/>'
  // ligne de gueule
  + '<path d="M-3.2 6.6 Q0 7.4 3.2 6.6" stroke="#5a3e10" stroke-width="0.5" fill="none" stroke-linecap="round"/>'
  // narine sombre à la base
  + '<ellipse cx="-1.4" cy="5.4" rx="0.7" ry="0.4" fill="#3a2808" transform="rotate(-20 -1.4 5.4)"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'bec', label: 'Bec', category: 'mutation',
  overlays: [{ bone: 'tete', svg: BEC, view: 'front' }],
};
