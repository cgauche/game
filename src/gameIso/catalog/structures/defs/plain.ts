import type { StructureAppearanceDef } from '../types';

/** Mur sans structure (arête nue) — bois : palette iso par défaut + repli des ids inconnus. */
export const structureAppearance: StructureAppearanceDef = {
  id: 'plain',
  label: 'Mur',
  material: 'bois',
  face: '#6e5940',
  wood: {
    faceN: '#5d4c36', faceE: '#6e5940', insetN: '#4b3d2b', insetE: '#594732',
    frameN: '#6b573e', frameE: '#7c6647', capN: '#806b4b', capE: '#917a58',
    skirtN: '#3c3022', skirtE: '#473829', woodRubble: '#4b3d2b', woodRubbleHi: '#5d4c36',
  },
};
