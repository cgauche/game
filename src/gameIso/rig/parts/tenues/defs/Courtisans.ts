import type { TenueDef } from '../types';

// Archétype de classe Courtisans : tenue de cour pourpre.
export const tenue: TenueDef = {
  name: 'Courtisans',
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#7a3a6a"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2440"/>`,
  },
};
