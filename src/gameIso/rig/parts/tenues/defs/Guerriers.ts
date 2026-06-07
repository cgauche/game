import type { TenueDef } from '../types';

// Archétype de classe Guerriers : cuirasse d'acier + braies sombres.
export const tenue: TenueDef = {
  name: 'Guerriers',
  set: {
    torse: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="@metal" stroke="#3a4150"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet2"/>`,
  },
  palette: { metal: '#9aa6b8', vet2: '#3a2c22' },
};
