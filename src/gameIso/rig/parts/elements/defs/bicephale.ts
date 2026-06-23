import type { AppearanceElement } from '../types';

// Bicéphale : une SECONDE tête complète, décalée latéralement (à droite), partageant le cou et
// posée plus bas/plus petite que la principale. Crâne de peau, oreille, deux yeux, nez et bouche —
// silhouette de visage humain réduit, penché vers l'épaule. Os tête, face.
const TETE2 = '<g data-mut="bicephale" transform="translate(7.5 3) scale(0.62) rotate(7)">'
  // cou rattachant la seconde tête
  + '<path d="M-2.4 9 L-2 14 L2 14 L2.4 9 Z" fill="#c9a07a" stroke="#9a6a50" stroke-width="0.6"/>'
  // crâne / visage
  + '<ellipse cx="0" cy="2" rx="6.2" ry="7.4" fill="#c9a07a" stroke="#9a6a50" stroke-width="0.7"/>'
  // oreille à droite
  + '<path d="M5.8 1.5 q2.4 0.4 1.6 3 q-1.2 1.4 -2.6 0.2 Z" fill="#c9a07a" stroke="#9a6a50" stroke-width="0.5"/>'
  // yeux
  + '<ellipse cx="-2.4" cy="0.5" rx="1.3" ry="0.9" fill="#fdfbf2" stroke="#7a5a44" stroke-width="0.3"/>'
  + '<circle cx="-2.4" cy="0.6" r="0.6" fill="#3a2a20"/>'
  + '<ellipse cx="2.4" cy="0.5" rx="1.3" ry="0.9" fill="#fdfbf2" stroke="#7a5a44" stroke-width="0.3"/>'
  + '<circle cx="2.4" cy="0.6" r="0.6" fill="#3a2a20"/>'
  // sourcils + nez + bouche
  + '<path d="M-3.6 -1.4 q1.2 -0.7 2.4 0 M1.2 -1.4 q1.2 -0.7 2.4 0" stroke="#6a4a36" stroke-width="0.5" fill="none" stroke-linecap="round"/>'
  + '<path d="M0 1.4 L-1 4 q1 0.8 2 0" stroke="#9a6a50" stroke-width="0.5" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2 6 q2 1.4 4 0" stroke="#6a3a32" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'bicephale', label: 'Bicéphale', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE2, view: 'front', layer: 60 }],
};
