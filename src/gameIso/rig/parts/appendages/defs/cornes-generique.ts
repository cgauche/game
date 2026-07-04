import type { AppendageDef } from '../types';

// Cornes de mutant génériques (petites, droites) — repli quand la tête ne déclare pas ses cornes.
// PROFIL : petites cornes balayées haut-arrière (proche devant lointaine).
export const appendage: AppendageDef = {
  id: 'cornes-generique',
  label: 'Cornes (générique)',
  front: `<path d="M-5 -1 q-2 -9 -8 -12 q2 7 4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M5 -1 q2 -9 8 -12 q-2 7 -4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`,
  profile: `<path d="M-2 -2 q-3 -8 -8 -11 q4 6 6 12 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M1 -3 q-2 -7 -6 -10 q3 6 5 11 z" fill="#bcb19f" stroke="#3a3026" stroke-width="0.5"/>`,
};
