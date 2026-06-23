import type { AppearanceElement } from '../types';

// Crête dentelée dressée le long du sommet du crâne (type iguane/coq) : suite de pointes charnues
// dégradées du plus grand au centre vers les bords. Posée DERRIÈRE la part de tête (layer -2) pour
// s'élever au-dessus du crâne, en vue de face.
const CRETE = '<g data-mut="crete-sur-la-tete">'
  // membrane charnue continue qui relie la base des pointes
  + '<path d="M-6 -6 Q-3 -10 0 -16 Q3 -10 6 -6 Z" fill="#b8584e" stroke="#7a322c" stroke-width="0.5"/>'
  // dents/pointes successives de la crête (centrale la plus haute)
  + '<path d="M-6 -6 L-5.6 -10 L-3.6 -7 Z" fill="#c96a5e" stroke="#7a322c" stroke-width="0.5"/>'
  + '<path d="M-3.6 -7 L-2.8 -13 L-1.2 -8.4 Z" fill="#c96a5e" stroke="#7a322c" stroke-width="0.5"/>'
  + '<path d="M-1.2 -8.4 L0 -16.5 L1.2 -8.4 Z" fill="#d4776a" stroke="#7a322c" stroke-width="0.5"/>'
  + '<path d="M1.2 -8.4 L2.8 -13 L3.6 -7 Z" fill="#c96a5e" stroke="#7a322c" stroke-width="0.5"/>'
  + '<path d="M3.6 -7 L5.6 -10 L6 -6 Z" fill="#c96a5e" stroke="#7a322c" stroke-width="0.5"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'crete-sur-la-tete', label: 'Crête sur la tête', category: 'mutation',
  overlays: [{ bone: 'tete', svg: CRETE, layer: -2, view: 'front' }],
};
