import type { AppearanceElement } from '../types';
import { plumeFan } from '../../textures';

// Plumage épars (textures.ts) : épaulettes en éventail sur les DEUX épaules, crête derrière le crâne
// (perce les cheveux) et plumes le long de l'avant-bras — des panaches qui JAILLISSENT du corps.
const g = (svg: string) => `<g data-mut="plumes-eparses">${svg}</g>`;
const PLUMES_EPAULE_G = g(plumeFan(0, 0.5, { n: 3, k: 0.9, baseRot: -14 }));
const PLUMES_EPAULE_D = g(plumeFan(0, 0.5, { n: 3, k: 0.8, baseRot: 14 }));
const PLUMES_CRETE = g(plumeFan(0, -4, { n: 4, spread: 84, k: 1.05 }));
const PLUMES_BRAS = g(plumeFan(-1.4, 7, { n: 2, spread: 26, k: 0.62, baseRot: -76 }) + plumeFan(-1.2, 12, { n: 1, k: 0.5, baseRot: -82, colors: ['#8a6a48'] }));

export const element: AppearanceElement = {
  key: 'plumes-eparses', label: 'Plumes éparses', category: 'mutation',
  overlays: [
    { bone: 'epauleG', svg: PLUMES_EPAULE_G },
    { bone: 'epauleD', svg: PLUMES_EPAULE_D },
    { bone: 'tete', svg: PLUMES_CRETE, behind: true },
    { bone: 'avantBrasG', svg: PLUMES_BRAS },
  ],
};
