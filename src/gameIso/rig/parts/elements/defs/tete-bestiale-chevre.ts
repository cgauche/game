import type { AppearanceElement } from '../types';

// Tête de chèvre/bouc (Tête bestiale, sous-table EDOC) : museau allongé clair, barbiche, yeux à
// pupille horizontale, longues oreilles tombantes, cornes recourbées vers l'ARRIÈRE (≠ taureau). Os tête.
// Cornes derrière (layer -2), reste en face.
const TETE_CHEVRE = '<g data-mut="tete-bestiale-chevre">'
  // cornes de bouc, annelées, partant du sommet et recourbées vers l'arrière
  + '<path d="M-3 -5 Q-6 -12 -3.5 -17 Q-3 -12 -1.6 -6 Z" fill="#b6a384" stroke="#7a6748" stroke-width="0.6"/>'
  + '<path d="M3 -5 Q6 -12 3.5 -17 Q3 -12 1.6 -6 Z" fill="#b6a384" stroke="#7a6748" stroke-width="0.6"/>'
  + '<path d="M-4.6 -9 L-2.6 -9.6 M-5 -12.5 L-3.4 -13 M3.4 -13 L5 -12.5 M2.6 -9.6 L4.6 -9" stroke="#7a6748" stroke-width="0.4" stroke-linecap="round"/>'
  // longues oreilles tombantes sur les côtés
  + '<path d="M-5 -1 Q-11 0 -10 6 Q-7 4 -4.5 3 Z" fill="#cdb79a" stroke="#8a7858" stroke-width="0.6"/>'
  + '<path d="M5 -1 Q11 0 10 6 Q7 4 4.5 3 Z" fill="#cdb79a" stroke="#8a7858" stroke-width="0.6"/>'
  // face claire allongée
  + '<path d="M-4.4 -3 Q0 -5.5 4.4 -3 Q4 6 2 11 Q0 12.5 -2 11 Q-4 6 -4.4 -3 Z" fill="#d6c6a8" stroke="#8a7858" stroke-width="0.5"/>'
  // yeux à pupille horizontale (caprins)
  + '<ellipse cx="-3" cy="0.5" rx="1.5" ry="1.1" fill="#d8b24a" stroke="#6a5020" stroke-width="0.3"/>'
  + '<ellipse cx="3" cy="0.5" rx="1.5" ry="1.1" fill="#d8b24a" stroke="#6a5020" stroke-width="0.3"/>'
  + '<rect x="-3.9" y="0.1" width="1.8" height="0.8" rx="0.35" fill="#1a1208"/>'
  + '<rect x="2.1" y="0.1" width="1.8" height="0.8" rx="0.35" fill="#1a1208"/>'
  // naseaux au bout du museau
  + '<ellipse cx="-1.1" cy="10.4" rx="0.7" ry="0.9" fill="#5a4836"/><ellipse cx="1.1" cy="10.4" rx="0.7" ry="0.9" fill="#5a4836"/>'
  // barbiche sous le menton
  + '<path d="M-1.6 12 Q-2.4 15.5 -1 16.5 Q0 14.5 0.4 16.8 Q1.6 15 1.4 12 Z" fill="#b8a684" stroke="#8a7858" stroke-width="0.4"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-chevre', label: 'Tête bestiale (Chèvre)', category: 'mutation',
  overlays: [
    { bone: 'tete', svg: TETE_CHEVRE, view: 'front' },
  ],
};
