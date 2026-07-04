import type { TenueDef } from '../types';

// Prophète gris : robe rituelle grise du clergé du Rat Cornu — drapé à capuche REJETÉE
// (les cornes restent visibles), ceinture de corde, amulette de malepierre, symbole cornu.
export const tenue: TenueDef = {
  name: 'Prophète gris',
  palette: { vet1: '#8e887c', vet2: '#5f594e', cuir: '#54483a', metal: '#7a9a6a' },
  set: {
    torse: `<g stroke-linejoin="round">`
      // capuche rejetée en arrière (bourrelet aux épaules)
      + `<path d="M-12 -26 Q0 -32 12 -26 L10 -20 Q0 -25 -10 -20 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>`
      // robe drapée
      + `<path d="M-13 -25 Q0 -29 13 -25 L13 6 L12 34 Q0 38 -12 34 L-13 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
      + `<path d="M-6 -22 L-7 34 M6 -22 L7 34" stroke="@vet1O" stroke-width="0.7" opacity="0.6" fill="none"/>`
      // ceinture de corde nouée + pans
      + `<path d="M-12 8 Q0 11 12 8" stroke="@cuir" stroke-width="2.6" fill="none"/>`
      + `<path d="M0 10 Q-1 18 1 24 M2 10 Q3 16 2 22" stroke="@cuir" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
      // amulette de malepierre (éclat vert serti) + symbole du Rat Cornu gravé
      + `<circle cx="0" cy="-12" r="3" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
      + `<path d="M-1.2 -13 L0 -10.4 L1.2 -13 L0 -14.4 Z" fill="@metal" stroke="#2c3a24" stroke-width="0.4"/>`
      + `<path d="M-4 -2 L0 4 L4 -2 M-4 -2 q-1.6 -2.6 0 -4.4 M4 -2 q1.6 -2.6 0 -4.4" stroke="@vet2O" stroke-width="1" fill="none"/>`
      + `</g>`,
    bras: `<g stroke-linejoin="round">`
      // manche LARGE tombante
      + `<path d="M-5 -3 Q0 -5.6 5 -3 L6.5 14 Q7.5 19 4 20 L-4 20 Q-7.5 19 -6.5 14 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-5.5 14 Q0 16.5 5.5 14" stroke="@vet1O" stroke-width="0.7" fill="none" opacity="0.6"/>`
      + `<path d="M-2 -1 L-2.6 18 M2 -1 L2.6 18" stroke="@vet1O" stroke-width="0.5" opacity="0.4" fill="none"/>`
      + `</g>`,
    jambes: `<g stroke-linejoin="round">`
      // bas de robe (la jambe disparaît dans le drapé), pied griffu libre en bas
      + `<path d="M-5.5 0 Q0 -1.6 5.5 0 L5 26 Q4.6 38 3.6 44 L-3.6 44 Q-4.6 38 -5 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-2 2 L-2.6 42 M2 2 L2.6 42" stroke="@vet1O" stroke-width="0.6" opacity="0.5" fill="none"/>`
      + `<path d="M-3.6 44 Q0 45.6 3.6 44 L3.4 47 Q0 48.4 -3.4 47 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>`
      + `</g>`,
  },
};
