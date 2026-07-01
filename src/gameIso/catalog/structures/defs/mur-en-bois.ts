import type { StructureAppearanceDef } from '../types';

/** Mur en bois — apparence identique au mur nu (bois), désignée explicitement par structure. */
export const structureAppearance: StructureAppearanceDef = {
  id: 'mur-en-bois',
  label: 'Mur en bois',
  material: 'bois',
  face: '#6e5940',
  wood: {
    faceN: '#5d4c36', faceE: '#6e5940', insetN: '#4b3d2b', insetE: '#594732',
    frameN: '#6b573e', frameE: '#7c6647', capN: '#806b4b', capE: '#917a58',
    skirtN: '#3c3022', skirtE: '#473829', woodRubble: '#4b3d2b', woodRubbleHi: '#5d4c36',
  },
};
