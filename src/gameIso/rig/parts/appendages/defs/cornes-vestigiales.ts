import type { AppendageDef } from '../types';

// Cornes VESTIGIALES de l'ungor (LDB 83 : « cornes vestigiales ou très courtes ») : moignons.
// PROFIL : deux moignons rapprochés, balayés haut-arrière.
export const appendage: AppendageDef = {
  id: 'cornes-vestigiales',
  label: 'Cornes vestigiales',
  front: `<path d="M-5.5 -6 Q-7.5 -9 -6.5 -12 Q-4.5 -9.5 -3.5 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/><path d="M5.5 -6 Q7.5 -9 6.5 -12 Q4.5 -9.5 3.5 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`,
  profile: `<path d="M-1 -6 Q-3.5 -9 -3 -12.5 Q-1 -10 0 -7.5 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/><path d="M1.6 -6.5 Q-0.4 -9 -0.1 -12 Q1.4 -10 2.4 -8 Z" fill="#cfc4a8" stroke="#3a3026" stroke-width="0.5"/>`,
};
