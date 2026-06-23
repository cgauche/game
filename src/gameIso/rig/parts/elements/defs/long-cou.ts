import type { AppearanceElement } from '../types';

// Long cou : cou démesurément allongé et sinueux portant la tête bien au-dessus des épaules
// (mutation Long cou, EDOC). Ancré à l'os tête, DERRIÈRE (layer -2) pour s'élever du buste sans
// masquer le visage : colonne de chair en S descendant du menton vers les épaules.
const LONG_COU = '<g data-mut="long-cou">'
  // tube du cou sinueux (S) montant des épaules jusqu'à la base du crâne
  + '<path d="M-3 13 Q-6 22 -2 30 Q1 36 -1 42 L3 42 Q5 36 3 30 Q1 22 3 13 Z" fill="#c9a07a" stroke="#9a6a52" stroke-width="0.6"/>'
  // anneaux de plis le long du cou (lecture « cou allongé »)
  + '<path d="M-4 20 Q0 22 3 20 M-5 27 Q-1 29 3 27 M-3 34 Q1 36 4 34" stroke="#9a6a52" stroke-width="0.4" fill="none" opacity="0.7"/>'
  // ombre médiane pour le volume
  + '<path d="M0 14 Q-1 28 1 42" stroke="#b98a64" stroke-width="0.6" fill="none" opacity="0.6"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'long-cou', label: 'Long cou', category: 'mutation',
  overlays: [{ bone: 'tete', svg: LONG_COU, layer: -2, view: 'front' }],
};
