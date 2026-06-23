import type { AppearanceElement } from '../types';

// Bras multiples : une paire de bras SUPPLÉMENTAIRES greffée sous les bras normaux, articulée et
// pourvue de mains (mutation Bras multiples, EDOC). Ancrée à l'os torse, DERRIÈRE (layer -2) pour
// émerger des flancs supérieurs sans recouvrir le buste. Repère local torse : épaules ≈ y -16.
const bras = (s: 1 | -1) =>
  // épaule + bras tombant des flancs, coude marqué, avant-bras vers l'avant
  `<path d="M${8 * s} -8 Q${13 * s} -6 ${14 * s} 2 Q${15 * s} 9 ${12 * s} 15 Q${10 * s} 12 ${10.5 * s} 4 Q${10 * s} -3 ${7 * s} -5 Z" fill="#c9a07a" stroke="#9a6a52" stroke-width="0.6"/>`
  // main au bout (paume + amorce de doigts)
  + `<ellipse cx="${12.5 * s}" cy="16.5" rx="2.1" ry="2.6" fill="#c9a07a" stroke="#9a6a52" stroke-width="0.5"/>`
  + `<path d="M${11 * s} 18.4 l${1 * s} 2.2 M${12.6 * s} 18.8 l${0.4 * s} 2.4 M${14 * s} 18.2 l${-0.3 * s} 2.2" stroke="#9a6a52" stroke-width="0.6" fill="none" stroke-linecap="round"/>`
  // pli du coude
  + `<path d="M${13 * s} 2 Q${11.5 * s} 3 ${10.5 * s} 4" stroke="#9a6a52" stroke-width="0.4" fill="none" opacity="0.7"/>`;

const BRAS_MULT = `<g data-mut="bras-multiples">${bras(1)}${bras(-1)}</g>`;

export const element: AppearanceElement = {
  key: 'bras-multiples', label: 'Bras multiples', category: 'mutation',
  overlays: [{ bone: 'torse', svg: BRAS_MULT, layer: -2 }],
};
