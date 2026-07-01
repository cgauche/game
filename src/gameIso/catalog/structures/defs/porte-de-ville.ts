import type { StructureAppearanceDef } from '../types';

/** Porte de ville — corps de garde fortifié en pierre : ouverture béante + herse + parapet crénelé. */
export const structureAppearance: StructureAppearanceDef = {
  id: 'porte-de-ville',
  label: 'Porte de ville',
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
  door: {
    openingFrac: 1.0, lintelPx: 4,
    herse: { bars: 6, topFrac: 0.9, traverseFracs: [0.4, 0.78], traverseColor: '#4a4d54' },
  },
};
