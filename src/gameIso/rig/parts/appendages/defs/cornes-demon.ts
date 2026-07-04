import type { AppendageDef } from '../types';

// Cornes de SANGUINAIRE / démon de Khorne (LDB 84 : « monstrueux visage cornu ») : croissants noirs
// épais qui s'évasent puis se recourbent. PROFIL : recourbées balayant haut-arrière (proche/lointaine).
export const appendage: AppendageDef = {
  id: 'cornes-demon',
  label: 'Cornes de démon',
  front: `<path d="M-4 -7 Q-13 -9 -16 -17 Q-18 -25 -12 -30 Q-9 -32 -6 -31 Q-11 -28 -12 -23 Q-12 -16 -8 -12 Q-6 -10 -2 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/><path d="M-13 -16 q-1.8 -1.2 -2.4 -3 M-13.5 -22 q-1.4 -1 -1.6 -2.6" stroke="#3a3026" stroke-width="0.6" fill="none"/><path d="M4 -7 Q13 -9 16 -17 Q18 -25 12 -30 Q9 -32 6 -31 Q11 -28 12 -23 Q12 -16 8 -12 Q6 -10 2 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/><path d="M13 -16 q1.8 -1.2 2.4 -3 M13.5 -22 q1.4 -1 1.6 -2.6" stroke="#3a3026" stroke-width="0.6" fill="none"/>`,
  profile: `<path d="M-1 -8 Q-11 -11 -14 -19 Q-16 -27 -10 -30 Q-12 -25 -11 -19 Q-9 -13 -1 -10 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/><path d="M3 -9 Q-4 -11 -7 -18 Q-9 -25 -4 -27 Q-6 -22 -6 -17 Q-4 -13 3 -11 Z" fill="#0f0b08" stroke="#000" stroke-width="0.5"/>`,
};
