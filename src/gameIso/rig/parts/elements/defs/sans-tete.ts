import type { AppearanceElement } from '../types';

// Sans tête : la TÊTE est supprimée (replace vide sur tete), le cou s'arrêtant sur un moignon
// arrondi ; le visage (deux yeux + bouche) migre sur le haut du torse. Os torse, face.
const MOIGNON = '<g data-mut="sans-tete-moignon">'
  // moignon de cou arrondi qui dépasse au-dessus des épaules
  + '<path d="M-3.4 1 Q-3 -3.2 0 -3.6 Q3 -3.2 3.4 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '</g>';
const VISAGE_TORSE = '<g data-mut="sans-tete-visage">'
  // moignon de cou (au-dessus du torse)
  + '<path d="M-3.4 0.5 Q-3 -3.4 0 -3.8 Q3 -3.4 3.4 0.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // deux yeux sur le buste
  + '<ellipse cx="-3" cy="8" rx="1.7" ry="1.2" fill="#efe9d2" stroke="#6a4a2c" stroke-width="0.4"/>'
  + '<ellipse cx="3" cy="8" rx="1.7" ry="1.2" fill="#efe9d2" stroke="#6a4a2c" stroke-width="0.4"/>'
  + '<circle cx="-2.7" cy="8" r="0.75" fill="#241b16"/>'
  + '<circle cx="3.3" cy="8" r="0.75" fill="#241b16"/>'
  // sourcils tordus
  + '<path d="M-4.6 6.2 Q-3 5.6 -1.4 6.2 M1.4 6.2 Q3 5.6 4.6 6.2" stroke="#3a2c1e" stroke-width="0.5" fill="none" stroke-linecap="round"/>'
  // bouche béante en travers du torse
  + '<path d="M-3.6 13 Q0 11.6 3.6 13.2 Q0 16 -3.6 13 Z" fill="#5a1010" stroke="#2e0808" stroke-width="0.5"/>'
  + '<path d="M-2.6 12.7 l0.7 0.9 l0.6 -0.9 l0.7 0.9 l0.6 -0.9 l0.7 0.9" stroke="#f2ead4" stroke-width="0.5" fill="none"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'sans-tete', label: 'Sans tête', category: 'mutation',
  overlays: [
    { bone: 'tete', svg: '', replace: true }, // tête supprimée
    { bone: 'torse', svg: VISAGE_TORSE, view: 'front' },
    { bone: 'torse', svg: MOIGNON }, // moignon vu de partout (dos/profil)
  ],
};
