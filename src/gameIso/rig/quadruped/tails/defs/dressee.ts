import type { QuadTailDef } from '../types';
import { QUEUE_BACK_REPTILE } from '../kit';

export const quadTail: QuadTailDef = {
  key: 'dressee',
  label: 'Dressée en S (pointe osseuse)',
  art: {
    // LONGUE queue fine dressée en S au-dessus de la croupe, pointe osseuse (ZI 66 l. « longue
    // queue ») — une queue traînante sortirait du gabarit 120×150 (le corps massif de la chimère
    // touche déjà le bord arrière) ; même compensation d'os que 'reptile'.
    profile: (() => {
      const d = 'M0 0 Q-9 -6 -10.5 -20 Q-11.5 -34 -6 -45 Q-2.5 -52 3 -57';
      return `<g transform="rotate(-42)">` +
        `<path d="${d}" fill="none" stroke="@corps" stroke-width="4.6" stroke-linecap="round"/>` +
        `<path d="M-8.5 -30 Q-9 -42 -3.5 -50 Q-0.5 -54 3 -57" fill="none" stroke="@corps" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.5"/>` +
        `<path d="M-12.4 -14 l-2.4 -1.6 l2.2 -1.2 M-13 -26 l-2.4 -0.8 l2 -1.8 M-11 -38 l-2 -2 l2.4 -1.2 M-6.2 -47 l-1.2 -2.6 l2.4 -0.6" stroke="@corpsO" stroke-width="0.8" fill="none" stroke-linecap="round"/>` + // épines du fouet
        `<path d="M3 -57 l5 -3.6 l-1.8 5.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // pointe osseuse
        `</g>`;
    })(),
    back: QUEUE_BACK_REPTILE,
  },
};
