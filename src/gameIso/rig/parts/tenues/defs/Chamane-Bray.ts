import type { TenueDef } from '../types';
import { NU_TORSE_FRONT, NU_TORSE_BACK, NU_TORSE_PROFILE, NU_JAMBE } from '../nuViews';

// Tenue du CHAMANE-BRAY : fétiches d'os au poitrail (collier d'osselets + crâne votif) —
// c'est de l'ÉQUIPEMENT rituel, séparé du corps nu (cornes/fourrure = race Homme-bête).
// bareFoot : sabots/pieds griffus de la race, pas de bottes. Os en couleurs littérales
// (l'ivoire d'os n'est pas une étoffe), cordon en @cuir.
export const tenue: TenueDef = {
  name: 'Chamane-Bray',
  career: true,
  bareFoot: true,
  palette: { cuir: '#3a2a1a' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">${NU_TORSE_FRONT}`
        + `<path d="M-9 -25 Q0 -19 9 -25" stroke="@cuir" stroke-width="1.1" fill="none"/>`
        + `<path d="M-6.6 -22.4 l0 3.4 M-3.4 -21.2 l0 3.8 M3.4 -21.2 l0 3.8 M6.6 -22.4 l0 3.4" stroke="#ddd2b6" stroke-width="1.6" stroke-linecap="round"/>`
        + `<path d="M-2 -21 Q-2.4 -16.4 0 -16 Q2.4 -16.4 2 -21 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`
        + `<circle cx="-0.8" cy="-18.6" r="0.45" fill="#1a0e06"/><circle cx="0.8" cy="-18.6" r="0.45" fill="#1a0e06"/>`
        + `<path d="M-0.7 -16.8 l1.4 0" stroke="#1a0e06" stroke-width="0.4"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">${NU_TORSE_BACK}`
        + `<path d="M-7.5 -25.5 Q0 -22.5 7.5 -25.5" stroke="@cuir" stroke-width="1.1" fill="none"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">${NU_TORSE_PROFILE}`
        + `<path d="M-4 -25 Q2 -20 6.5 -24" stroke="@cuir" stroke-width="1" fill="none"/>`
        + `<path d="M2.4 -21.4 l0 3.2 M4.6 -21.8 l0 3" stroke="#ddd2b6" stroke-width="1.4" stroke-linecap="round"/>`
        + `<path d="M-0.4 -20.6 Q-0.8 -16.6 1.2 -16.2 Q3 -16.8 2.6 -20.8 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`
        + `</g>`,
    },
    jambes: NU_JAMBE,
  },
};
