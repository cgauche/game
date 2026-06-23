import type { AppearanceElement } from '../types';

// Jambes multiples : paire de jambes SUPPLÉMENTAIRE sous le bassin, le corps reposant sur quatre
// membres inférieurs façon centauroïde (mutation Jambes multiples, EDOC). Ancrée à l'os bassin,
// DERRIÈRE (layer -2) pour que les jambes en plus jaillissent sous/derrière le bas du tronc.
const jambe = (s: 1 | -1) =>
  // cuisse + tibia avancés vers l'extérieur (silhouette de membre porteur en plus)
  `<path d="M${3 * s} 4 Q${8 * s} 8 ${9 * s} 18 Q${10 * s} 28 ${8 * s} 38 L${5 * s} 38 Q${6.5 * s} 28 ${5.5 * s} 18 Q${5 * s} 10 ${1 * s} 6 Z" fill="#c9a07a" stroke="#9a6a52" stroke-width="0.6"/>`
  // pied/sabot au bout
  + `<path d="M${4.5 * s} 37 Q${4 * s} 41 ${8.5 * s} 41.5 L${9 * s} 38 Z" fill="#b98a64" stroke="#7a5238" stroke-width="0.5"/>`
  // pli du genou
  + `<path d="M${6 * s} 18 Q${8 * s} 19 ${9 * s} 18" stroke="#9a6a52" stroke-width="0.4" fill="none" opacity="0.7"/>`;

const JAMBES_MULT = `<g data-mut="jambes-multiples">${jambe(1)}${jambe(-1)}</g>`;

export const element: AppearanceElement = {
  key: 'jambes-multiples', label: 'Jambes multiples', category: 'mutation',
  overlays: [{ bone: 'bassin', svg: JAMBES_MULT, layer: -2 }],
};
