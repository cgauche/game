import type { AppendageDef } from '../types';

// Grandes cornes bovines crème en V (Minotaure/Taureau) — plus écartées.
// PROFIL : les deux cornes bovines balaient vers le haut-arrière, corne proche devant la lointaine.
export const appendage: AppendageDef = {
  id: 'cornes-taureau',
  label: 'Cornes de taureau',
  front: `<path d="M-7 -5 Q-16 -10 -16 -22 Q-11 -15 -4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M7 -5 Q16 -10 16 -22 Q11 -15 4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/>`,
  profile: `<path d="M-1 -6 Q-10 -11 -13 -21 Q-8 -14 0 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M3 -7 Q-3 -11 -6 -19 Q-2 -14 4 -9 Z" fill="#cbc1a3" stroke="#3a3026" stroke-width="0.6"/>`,
};
