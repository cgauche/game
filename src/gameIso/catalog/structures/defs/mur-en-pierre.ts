import type { StructureAppearanceDef } from '../types';

/** Mur en pierre — rempart crénelé (parapet + merlons + bandes de fer), couleurs var CSS. */
export const structureAppearance: StructureAppearanceDef = {
  id: 'mur-en-pierre',
  label: 'Mur en pierre',
  material: 'pierre',
  face: 'var(--struct-face)',
  band: 'var(--struct-band)',
  cap: 'var(--struct-cap)',
  rubble: 'var(--struct-rubble)',
  rubbleHi: 'var(--struct-rubble-hi)',
  parapet: {
    heightLevelFrac: 0.32,
    merlonCount: 5, merlonStep: 2, merlonHeightPx: 6,
    bands: [0.28, 0.56, 0.82], bandThickPx: 2.4, parapetBandFrac: 0.72, arasePx: 3,
  },
};
