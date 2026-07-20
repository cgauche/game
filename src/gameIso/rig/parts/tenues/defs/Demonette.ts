import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

// Tenue de la DÉMONETTE (illustration LDB 84 p.337) : corset noir-indigo liseré d'or + jupe à
// pans ornés. ÉQUIPEMENT séparé du corps nu (chair lilas/cornes/pinces = morphologie du def).
// bareFoot : jambes digitigrades griffues, pas de bottes. NB : les brassards restent des
// features du def — le slot bras serait écrasé par les bras-pinces monstrueux.
export const tenue: TenueDef = {
  label: 'Démonette',
  id: "demonette",
  bareFoot: true,
  palette: { vet1: '#1f1c30', vet2: '#c8a23c' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">${BODIES.nu.torseFront}`
        + `<path d="M-10 -14 Q0 -11.5 10 -14 L11 8 Q0 12 -11 8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-10 -13.6 Q0 -11 10 -13.6" stroke="@vet2" stroke-width="1" fill="none"/>`
        + `<path d="M-10.6 7.4 Q0 11 10.6 7.4" stroke="@vet2" stroke-width="1" fill="none"/>`
        + `<path d="M0 -11.5 L0 10" stroke="@vet2" stroke-width="0.6" opacity="0.8"/>`
        + `<path d="M-5 -12.6 L-5.6 9 M5 -12.6 L5.6 9" stroke="@vet1O" stroke-width="0.6" opacity="0.7"/>`
        + `<path d="M-10 9 Q0 11.5 10 9 L9 28 Q6 31.5 3 28.5 L3.4 12 L-3.4 12 L-3 28.5 Q-6 31.5 -9 28 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-10 8.4 Q0 10.8 10 8.4 L10 11.2 Q0 13.4 -10 11.2 Z" fill="@vet1H" stroke="@vet2" stroke-width="0.6"/>`
        + `<path d="M-6.8 15 q1.6 2.4 0 4.8 q1.8 2 0.5 4.6 M6.8 15 q-1.6 2.4 0 4.8 q-1.8 2 -0.5 4.6" stroke="@vet2" stroke-width="0.5" fill="none" opacity="0.85"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">${BODIES.nu.torseBack}`
        + `<path d="M-8.5 -14 Q0 -12 8.5 -14 L9 8 Q0 11.5 -9 8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 -12.5 L0 9.5 M-2.2 -12.8 L2.2 -8.4 M-2.2 -8.4 L2.2 -12.8 M-2.2 -7 L2.2 -2.6 M-2.2 -2.6 L2.2 -7 M-2.2 -1 L2.2 3.4 M-2.2 3.4 L2.2 -1" stroke="@vet2" stroke-width="0.55" opacity="0.9" fill="none"/>`
        + `<path d="M-8.5 8.6 Q0 11 8.5 8.6 L8 26 Q5 29.5 2.6 27 L3 11.6 L-3 11.6 L-2.6 27 Q-5 29.5 -8 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">${BODIES.nu.torseProfile}`
        + `<path d="M-5.5 -13.5 Q1.5 -11.5 7 -13.5 L7.5 8 Q1 11 -5.5 8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-5.5 -13 Q1.5 -11 7 -13" stroke="@vet2" stroke-width="0.9" fill="none"/>`
        + `<path d="M-5.8 7.4 Q1 10.4 7.4 7.4" stroke="@vet2" stroke-width="0.9" fill="none"/>`
        + `<path d="M-5.5 8.6 Q1 11 7 8.6 L6.4 27 Q3.5 30.5 1 27.6 L1.4 11.8 L-2.6 11.4 L-2.4 26 Q-4.4 28.6 -5.8 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-3.4 15 q1.4 2.2 0 4.4 M4.2 15 q-1.4 2.2 0 4.4" stroke="@vet2" stroke-width="0.5" fill="none" opacity="0.85"/>`
        + `</g>`,
    },
    jambes: BODIES.nu.jambe,
  },
};
