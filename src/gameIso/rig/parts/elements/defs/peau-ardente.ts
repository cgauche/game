import type { AppearanceElement } from '../types';

// Peau ardente : la chair est parcourue de craquelures incandescentes, de braises affleurantes et de
// fumerolles qui montent — un corps de magma sous une croûte sombre (mutation Peau ardente, EDOC).
// Posée sur torse + épaules pour lire sur tout le corps ; visible de partout (pas de view).

// craquelures + braises sur le buste
const TORSE = '<g data-mut="peau-ardente">'
  // halo de chaleur diffus
  + '<ellipse cx="0" cy="8" rx="11" ry="14" fill="#ff7a1e" opacity="0.12"/>'
  // craquelures rougeoyantes (réseau de fissures)
  + '<path d="M-5 2 Q-2 6 -4 11 M-1 1 Q1 7 -1 14 M4 2 Q1.5 7 4.5 12 M-6 9 Q-3 10 -1 8 M2 10 Q4 11 6 9" stroke="#ff4500" stroke-width="1" fill="none" opacity="0.85" stroke-linecap="round"/>'
  // cœur plus clair des fissures (jaune incandescent)
  + '<path d="M-5 2 Q-2 6 -4 11 M-1 1 Q1 7 -1 14 M4 2 Q1.5 7 4.5 12" stroke="#ffd24a" stroke-width="0.4" fill="none" opacity="0.9" stroke-linecap="round"/>'
  // braises affleurantes
  + '<circle cx="-3" cy="5" r="0.9" fill="#ffb02e"/><circle cx="2.5" cy="4" r="0.7" fill="#ff7a1e"/>'
  + '<circle cx="-1.5" cy="11" r="0.8" fill="#ffd24a"/><circle cx="3.5" cy="9.5" r="0.6" fill="#ff5a0e"/>'
  // fumerolles montantes
  + '<path d="M-2 -1 q-1.4 -3 0.4 -5 q1.2 -2 -0.2 -4" stroke="#888" stroke-width="0.7" fill="none" opacity="0.35" stroke-linecap="round"/>'
  + '<path d="M3 0 q1.2 -2.6 -0.3 -5" stroke="#999" stroke-width="0.6" fill="none" opacity="0.3" stroke-linecap="round"/>'
  + '</g>';

// reprise des braises/fissures à l'épaule
const EPAULE = '<g data-mut="peau-ardente">'
  + '<ellipse cx="0" cy="2" rx="4.5" ry="5" fill="#ff7a1e" opacity="0.12"/>'
  + '<path d="M-2 -2 Q0 1 -1 4 M2 -2 Q0 1 1.5 4" stroke="#ff4500" stroke-width="0.9" fill="none" opacity="0.85" stroke-linecap="round"/>'
  + '<circle cx="0.5" cy="1" r="0.7" fill="#ffd24a"/><circle cx="-1.3" cy="3" r="0.5" fill="#ff7a1e"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'peau-ardente', label: 'Peau ardente', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: TORSE },
    { bone: 'epauleG', svg: EPAULE },
    { bone: 'epauleD', svg: EPAULE },
  ],
};
