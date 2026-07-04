import type { TenueDef } from '../types';
import { BODIES } from '../../bodies';

// Tenue du SANGUINAIRE (illustration LDB p.337) : pagne loqueteux gris ceinturé + bourse.
// C'est de l'ÉQUIPEMENT (séparé du corps nu — la musculature/cornes vivent sur la race
// Démon) ; bareFoot : le démon reste griffu, pas de bottes.
const CEINTURE = `<path d="M-10.5 8.2 Q0 10.6 10.5 8.2 L10.5 11 Q0 13.2 -10.5 11 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`;
export const tenue: TenueDef = {
  name: 'Sanguinaire',
  bareFoot: true,
  palette: { vet1: '#7d766a', cuir: '#4a3424' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">${BODIES.nu.torseFront}`
        + `<path d="M-8.5 9 Q0 11.5 8.5 9 L8 15 L9.5 24 L7.5 21 L5.5 26.5 L2 22 L0 28 L-3 22.5 L-6 26 L-8 21 L-9.5 23.5 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-5 11.5 L-6.5 22 M0.5 12 L0 24 M5.5 11.5 L7 21" stroke="@vet1O" stroke-width="0.5" opacity="0.5" fill="none"/>`
        + CEINTURE
        + `<rect x="4.6" y="11.4" width="3.8" height="5.2" rx="0.8" fill="@cuirH" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">${BODIES.nu.torseBack}`
        + `<path d="M-8 9 Q0 11.5 8 9 L7.5 16 L8.5 23 L5.5 20.5 L3 25 L0 21 L-3 25 L-5.5 20.5 L-8.5 23 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + CEINTURE
        + `</g>`,
      profile: `<g stroke-linejoin="round">${BODIES.nu.torseProfile}`
        + `<path d="M-5.5 9 Q1 11 6.5 9 L6 15 L7 23 L4.5 20 L2.5 25 L0 21 L-2.5 24.5 L-4.5 20 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-5.5 8.4 Q1 10.4 6.5 8.4 L6.5 11 Q1 12.8 -5.5 11 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<rect x="2.6" y="11.2" width="3.2" height="4.6" rx="0.8" fill="@cuirH" stroke="@cuirO" stroke-width="0.5"/>`
        + `</g>`,
    },
    jambes: BODIES.nu.jambe,
  },
};
