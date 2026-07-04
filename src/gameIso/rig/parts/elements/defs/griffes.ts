import type { AppearanceElement } from '../types';

// Longues griffes recourbées aux mains (goule) — calque sur l'os `main` (poignet origine, doigts +y).
// Art PARTAGÉ (owner) : cet élément + monsterInjection (m.griffes) + creatures/defs qui posent des griffes.
export const GRIFFES_ART = `<path d="M-2.6 3.4 q-1.4 3 -1.2 6 M-0.9 4.4 q-0.5 3.4 -0.2 6.4 M0.9 4.4 q0.5 3.4 0.2 6.4 M2.6 3.4 q1.4 3 1.2 6" stroke="#241a12" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;

export const element: AppearanceElement = {
  key: 'griffes', label: 'Griffes', category: 'trait',
  overlays: [
    { bone: 'mainG', svg: GRIFFES_ART, scale: 'bone', layer: 98 },
    { bone: 'mainD', svg: GRIFFES_ART, scale: 'bone', layer: 98 },
  ],
};
