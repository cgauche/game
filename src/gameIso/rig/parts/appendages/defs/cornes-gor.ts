import type { AppendageDef } from '../types';

// GRANDE paire de cornes du Gor (LDB 83 : « les plus grandes sont les meilleures » — statut) : larges
// croissants annelés qui s'évasent. PROFIL : croissants balayés haut-arrière (proche devant lointaine).
export const appendage: AppendageDef = {
  id: 'cornes-gor',
  label: 'Cornes de Gor',
  front: `<path d="M-5 -3 Q-15 -8 -18 -19 Q-19 -28 -12 -33 Q-16 -26 -13 -19 Q-10 -11 -2 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.6"/><path d="M-14 -14 q-2.5 -1.4 -3.4 -3.4 M-16 -20 q-2 -1.2 -2.6 -3 M-15.5 -26 q-1.8 -0.8 -2.3 -2.4" stroke="#8a7a5c" stroke-width="0.7" fill="none"/><path d="M5 -3 Q15 -8 18 -19 Q19 -28 12 -33 Q16 -26 13 -19 Q10 -11 2 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.6"/><path d="M14 -14 q2.5 -1.4 3.4 -3.4 M16 -20 q2 -1.2 2.6 -3 M15.5 -26 q1.8 -0.8 2.3 -2.4" stroke="#8a7a5c" stroke-width="0.7" fill="none"/>`,
  profile: `<path d="M-2 -4 Q-13 -8 -16 -19 Q-17 -28 -10 -33 Q-14 -26 -11 -19 Q-8 -11 0 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.6"/><path d="M-12 -14 q-2.2 -1.3 -3 -3.2 M-14 -20 q-1.8 -1.1 -2.4 -2.8" stroke="#8a7a5c" stroke-width="0.7" fill="none"/><path d="M2 -5 Q-6 -9 -9 -18 Q-10 -25 -4 -29 Q-8 -23 -6 -18 Q-4 -12 3 -8 Z" fill="#cabf9f" stroke="#3a3026" stroke-width="0.6"/>`,
};
