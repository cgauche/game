import type { AppendageDef } from '../types';

// Queue de RAT (skaven) — longue, NUE, ROSE, en S, traînant au sol : LE tell de silhouette du skaven.
// Repère os `bassin`. PROFIL (tête vers +x) : traîne derrière (-x), miroir de la vue de face.
export const appendage: AppendageDef = {
  id: 'queue-rat',
  label: 'Queue de rat',
  front: `<path d="M0 3 Q16 6 22 18 Q26 28 20 34 Q24 26 17 21 Q9 17 1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M2 5 Q15 8 20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M6 9 q1 1 0 2 M11 12 q1 1 0 2 M16 16 q1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`,
  profile: `<path d="M0 3 Q-16 6 -22 18 Q-26 28 -20 34 Q-24 26 -17 21 Q-9 17 -1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M-2 5 Q-15 8 -20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M-6 9 q-1 1 0 2 M-11 12 q-1 1 0 2 M-16 16 q-1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`,
};
