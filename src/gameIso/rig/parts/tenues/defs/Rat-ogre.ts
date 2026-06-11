import type { TenueDef } from '../types';
import { NU_TORSE_FRONT, NU_TORSE_BACK, NU_TORSE_PROFILE, NU_JAMBE } from '../nuViews';

// Tenue du RAT OGRE (illustration LDB p.339) : pagne-tablier loqueteux sanglé par ses
// maîtres Molder. ÉQUIPEMENT séparé du corps nu (chair cousue, fourrure, épines = def).
// bareFoot : pattes griffues, pas de bottes.
export const tenue: TenueDef = {
  name: 'Rat ogre',
  career: true,
  bareFoot: true,
  palette: { vet1: '#9a8a6a', cuir: '#4a3a28' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">${NU_TORSE_FRONT}`
        + `<path d="M-9 8 Q0 10.5 9 8 L8.5 14 L10 23 L6.5 20 L4.5 25 L1.5 21 L-0.5 26 L-3 21.5 L-5.5 24.5 L-7.5 20 L-10 22.5 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-9 7.4 Q0 9.8 9 7.4 L9 10 Q0 12.2 -9 10 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">${NU_TORSE_BACK}`
        + `<path d="M-7.5 8 Q0 10.5 7.5 8 L7 15 L8 22 L5 19.5 L2.5 24 L0 20 L-2.5 24 L-5 19.5 L-8 22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-7.5 7.4 Q0 9.6 7.5 7.4 L7.5 10 Q0 12 -7.5 10 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">${NU_TORSE_PROFILE}`
        + `<path d="M-5.5 8.6 Q1 10.8 6.5 8.6 L6 14 L7 22 L4.5 19 L2.5 24 L0 20 L-2.5 23.5 L-4.5 19 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-5.5 8 Q1 10 6.5 8 L6.5 10.6 Q1 12.4 -5.5 10.6 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
    },
    jambes: NU_JAMBE,
  },
};
