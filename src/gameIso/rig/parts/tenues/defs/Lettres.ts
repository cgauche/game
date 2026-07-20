import type { TenueDef } from '../types';

// Archétype de classe Lettrés : robe longue + capuche.
export const tenue: TenueDef = {
  label: 'Lettrés',
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L8 4 L18 50 L-18 50 L-8 4 Z" fill="@vet1"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet2"/>`,
    tete: `<path d="M-9 -2 Q0 -22 9 -2 Q4 -4 0 -4 Q-4 -4 -9 -2Z" fill="@vet1"/>`,
  },
  palette: { vet1: '#282c58', vet2: '#171a36' },
};
