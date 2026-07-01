import type { StructureAppearanceDef } from '../types';

/** Porte blindée — rendu identique à la porte bois pour l'instant (bois ajouré + jambages). */
export const structureAppearance: StructureAppearanceDef = {
  id: 'porte-blindee',
  label: 'Porte blindée',
  material: 'bois',
  face: '#6e5940',
  wood: {
    faceN: '#5d4c36', faceE: '#6e5940', insetN: '#4b3d2b', insetE: '#594732',
    frameN: '#6b573e', frameE: '#7c6647', capN: '#806b4b', capE: '#917a58',
    skirtN: '#3c3022', skirtE: '#473829', woodRubble: '#4b3d2b', woodRubbleHi: '#5d4c36',
  },
  door: { openingFrac: 0.52, lintelPx: 4, jamb: '#6e5940', jambCap: '#8a7048' },
};
