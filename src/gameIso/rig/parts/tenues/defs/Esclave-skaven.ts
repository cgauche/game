import type { TenueDef } from '../types';

// Esclave skaven : chair à canon — haillon une-épaule déchiré, corde de servitude, pagne
// loqueteux. Bras et tête NUS (fourrure de la race).
export const tenue: TenueDef = {
  name: 'Esclave skaven',
  career: true,
  palette: { vet1: '#6e5f4a', cuir: '#4a3c2c' },
  set: {
    torse: `<g stroke-linejoin="round">`
      // haillon une-épaule (épaule droite nue), bord déchiré
      + `<path d="M-12 -26 Q-4 -29 2 -27 L11 6 L10 30 L8 28 L6 32 L3 29 L0 33 L-3 29 L-6 32 L-9 28 L-11 30 L-12 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-7 -20 L-8 26 M0 -22 L1 27" stroke="@vet1O" stroke-width="0.6" opacity="0.5" fill="none"/>`
      + `<path d="M-3 -8 l5 4 M4 2 l-6 4 M-2 12 l5 3" stroke="@vet1O" stroke-width="0.8" opacity="0.7"/>`
      // corde de servitude au cou, pendant sur le torse
      + `<path d="M-6 -27 Q0 -24 6 -27" stroke="@cuir" stroke-width="1.8" fill="none"/>`
      + `<path d="M3 -25.5 Q4.5 -14 3 -4" stroke="@cuir" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
      + `</g>`,
    jambes: `<g stroke-linejoin="round">`
      // pagne court loqueteux ; la jambe reste en fourrure nue dessous
      + `<path d="M-5 0 Q0 -1.6 5 0 L4.6 10 L2.6 8.6 L1 12 L-1 9 L-2.8 12 L-4.6 9.4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-4.4 2.5 Q0 4 4.4 2.5" stroke="@cuir" stroke-width="1.4" fill="none"/>`
      + `</g>`,
  },
};
