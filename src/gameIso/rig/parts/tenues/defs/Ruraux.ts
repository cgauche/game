import type { TenueDef } from '../types';

// Archétype de classe Ruraux : tunique de bure brune.
export const tenue: TenueDef = {
  label: 'Ruraux',
  id: "ruraux",
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="@vet1"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet2"/>`,
  },
  palette: { vet1: '#6a5a3a', vet2: '#5a4630' },
};
