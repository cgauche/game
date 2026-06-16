import type { AppearanceElement } from '../types';
import { scalesPatch } from '../../textures';

// Épines triangulaires hérissant flancs et épaules. La peau écailleuse recolorée corps entier passe
// par `appearance.colors` (olive reptilien). + TEXTURE d'écailles (textures.ts) sur la peau visible :
// tempes/mâchoire (face) et dos des mains.
const ECAILLES = '<g data-mut="ecailles-epineuses">'
  + '<path d="M-9 -14 l-3 -1.4 l2.2 2.8 Z M-9.5 -8 l-3.2 -0.8 l2.4 2.6 Z M-9.4 -2 l-3 -0.4 l2.2 2.4 Z'
  + ' M9 -14 l3 -1.4 l-2.2 2.8 Z M9.5 -8 l3.2 -0.8 l-2.4 2.6 Z M9.4 -2 l3 -0.4 l-2.2 2.4 Z" fill="@peauO" stroke="#2a2018" stroke-width="0.4"/>'
  + '</g>';
const ECAILLES_VISAGE = `<g data-mut="ecailles-epineuses">${scalesPatch(-7.6, -3.4, 2, 8.4, 2.1) + scalesPatch(3.4, 7.6, 2, 8.4, 2.1)}</g>`;
const ECAILLES_MAIN = `<g data-mut="ecailles-epineuses">${scalesPatch(-2.6, 2.6, 0.4, 5.4, 1.8)}</g>`;

export const element: AppearanceElement = {
  key: 'ecailles-epineuses', label: 'Écailles épineuses', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: ECAILLES },
    { bone: 'tete', svg: ECAILLES_VISAGE, view: 'front' },
    { bone: 'mainG', svg: ECAILLES_MAIN },
    { bone: 'mainD', svg: ECAILLES_MAIN },
  ],
};
