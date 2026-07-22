import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

// Tenue du GÉANT (« vêtu d'habits dépareillés marqués de plusieurs blasons différents » — Halagrundsor,
// ZI) : pagne loqueteux ceinturé + baudrier de cuir + rapiéçages héraldiques DÉPAREILLÉS cousus sur
// le torse nu. ÉQUIPEMENT séparé du corps (la masse brute vit sur la race) ; ne chausse pas (le
// géant va pieds nus — `perso.extremites` du def créature, #736 Lot 1).
const CEINTURE = `<path d="M-10.5 8 Q0 11 10.5 8 L10.5 11.5 Q0 14 -10.5 11.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
  + `<rect x="-2" y="8.4" width="4" height="4.4" rx="0.6" fill="@cuirH" stroke="@cuirO" stroke-width="0.5"/>`;
const PAGNE = `<path d="M-9 9 Q0 12 9 9 L9.5 18 L11 29 L7.5 25 L5.5 31 L2 25.5 L0 32 L-2 25.5 L-5.5 31 L-7.5 25 L-11 29 L-9.5 18 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
  + `<path d="M-5 12 L-6.5 26 M0.5 13 L0 28 M5.5 12 L7 25" stroke="@vet1O" stroke-width="0.5" opacity="0.5" fill="none"/>`;
const BALDRIC = `<path d="M-11 -20 L8 9 L4.5 11.5 L-14.5 -16.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`;
// blasons dépareillés (couleurs distinctes, cousus de travers) — le tell du géant pillard
const BLASONS = `<path d="M-9 -13 L-2.5 -11.5 L-3.5 -3.5 L-10 -5 Z" fill="#7a3b34" stroke="#241410" stroke-width="0.6"/>`
  + `<path d="M-7.5 -10 l2.5 0.6 M-8 -7.5 l2.5 0.6" stroke="#d8c8a0" stroke-width="0.5" opacity="0.6"/>`
  + `<path d="M2.5 -8 L9 -6.5 L8 2 L1.5 0.5 Z" fill="#36506a" stroke="#241410" stroke-width="0.6"/>`
  + `<path d="M4.5 -4.5 l2 0.5 l-1 2 Z" fill="#c9a93a" opacity="0.85"/>`;

export const tenue: TenueDef = {
  label: 'Géant',
  id: "geant",
  palette: { vet1: '#6e6450', cuir: '#4a3424' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">${BODIES.nu.torseFront}${BALDRIC}${BLASONS}${PAGNE}${CEINTURE}</g>`,
      back: `<g stroke-linejoin="round">${BODIES.nu.torseBack}${PAGNE}${CEINTURE}`
        + `<path d="M-8 -12 L-1 -10.5 L-2 -2.5 L-9 -4 Z" fill="#5a5240" stroke="#241410" stroke-width="0.6"/></g>`, // pièce cousue dans le dos
      profile: `<g stroke-linejoin="round">${BODIES.nu.torseProfile}`
        + `<path d="M-5.5 9 Q1 11 6.5 9 L6 18 L7 28 L4 24 L2 30 L0 24 L-2 29 L-4.5 23 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-5.5 8 Q1 10 6.5 8 L6.5 11 Q1 13 -5.5 11 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-1 -10 L5 -8.5 L4 -1 L-2 -2.5 Z" fill="#7a3b34" stroke="#241410" stroke-width="0.6"/></g>`,
    },
    jambes: BODIES.nu.jambe,
  },
};
