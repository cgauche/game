import type { AppearanceElement } from '../types';

// Extrémités armées : les MAINS sont remplacées par des lames osseuses — l'avant-bras se durcit en
// chair beige, le poignet se prolonge d'une longue lame d'os recourbée à pointe acérée et d'un éperon
// secondaire (mutation Extrémités armées, EDOC). Traitement « membre muté » : remplace les mains.
const LAME = '<g data-mut="extremites-armees">'
  // moignon de chair durcie au poignet
  + '<path d="M-2.4 -1.2 Q0 -2.4 2.4 -1.2 L1.8 3.2 Q0 4.2 -1.8 3.2 Z" fill="#b98a64" stroke="#7a5638" stroke-width="0.6" stroke-linejoin="round"/>'
  // grande lame osseuse principale (recourbée vers le bas, pointe acérée)
  + '<path d="M-1.8 2.4 Q-2.6 9 -1 14.6 Q0.2 16.4 1 14.4 Q1.4 8 2 2.4 Q0.2 3.4 -1.8 2.4 Z" fill="#d6c6a4" stroke="#8a7656" stroke-width="0.6" stroke-linejoin="round"/>'
  // arête centrale luisante de la lame
  + '<path d="M0.2 3.4 Q-0.4 9 0 14.4" stroke="#f0e8d2" stroke-width="0.6" fill="none" opacity="0.8" stroke-linecap="round"/>'
  // éperon osseux secondaire (vers l'extérieur)
  + '<path d="M1.6 3 Q4 4.4 4.8 7.6 Q3.4 7 2 5.6 Z" fill="#cdbd9a" stroke="#8a7656" stroke-width="0.5" stroke-linejoin="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'extremites-armees', label: 'Extrémités armées', category: 'mutation',
  overlays: [
    { bone: 'mainG', svg: LAME, replace: true },
    { bone: 'mainD', svg: LAME, replace: true },
  ],
};
