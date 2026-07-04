import type { AppendageDef } from '../types';

// Queue-FOUET de trait (Attaque caudale) : longue, débordant la hanche, terminée par une touffe
// (@cheveux). Rendue en DORSAL par traitVisuals (profondeur) — d'où l'art sans wrapper ici.
export const appendage: AppendageDef = {
  id: 'queue-fouet',
  label: 'Queue-fouet',
  front: `<path d="M0 2 Q14 7 19 17 Q22 26 17 31 Q20 23 13 18 Q5 13 0 10 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/><path d="M3 6 Q12 11 16 19" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/><path d="M17 31 q5 1.4 4.6 6 q-5 -0.4 -6.6 -4.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`,
  profile: `<path d="M-2 2 Q-15 6 -20 15 Q-23 24 -18 29 Q-21 21 -14 17 Q-6 12 -2 9 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/><path d="M-5 6 Q-13 10 -17 17" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/><path d="M-18 29 q-5 1.4 -4.6 6 q5 -0.4 6.6 -4.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`,
};
