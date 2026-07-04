import type { AppendageDef } from '../types';

// Queue générique (repli) — repère os `bassin`. PROFIL : traîne derrière (-x), miroir de la face.
export const appendage: AppendageDef = {
  id: 'queue-generique',
  label: 'Queue (générique)',
  front: `<path d="M0 2 Q13 9 17 24 Q11 23 7 15 Q3 9 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`,
  profile: `<path d="M0 2 Q-13 9 -17 24 Q-11 23 -7 15 Q-3 9 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`,
};
