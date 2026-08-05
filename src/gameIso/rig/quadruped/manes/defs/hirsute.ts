import type { QuadManeDef } from '../types';

export const quadMane: QuadManeDef = {
  key: 'hirsute',
  label: 'Hirsute (dressée)',
  params: ['neckLen'],
  art: {
    // fourrure DRESSÉE en dents le long du dos + touffe de gorge
    neck: (p) => {
      const L = 30 * p.neckLen;
      return `<path d="M-6 ${-L} l-4 -4 l1 5 l-4.5 -2.5 l1.8 4.4 l-4 -1 l2.2 3.8 l-3.4 0 l2.6 3.4 Q-9.5 ${-L * 0.4} -8.4 0 L-6.6 0 Q-8 ${-L * 0.45} -4.5 ${-L * 0.92} Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.45"/>` +
        `<path d="M8 ${-L * 0.3} q4 1.4 5 5 q-3.6 -0.4 -5.4 -2.2 M8.6 ${-L * 0.14} q3.4 1.6 4 4.6 q-3.2 -0.8 -4.6 -2.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    },
    // lobes de fourrure dentelés débordant le haut du poitrail (loup)
    chestRuff: `<path d="M-3 -19 Q-13 -16 -16 -3 Q-17 5 -13 12 Q-12.5 4 -9 -2 l-3.5 5.5 Q-9.5 -5 -5.5 -11 l-3 4.5 Q-6 -10 -2.5 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M3 -19 Q13 -16 16 -3 Q17 5 13 12 Q12.5 4 9 -2 l3.5 5.5 Q9.5 -5 5.5 -11 l3 4.5 Q6 -10 2.5 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`,
    // fourrure dorsale dressée au sommet de la croupe
    backTuft: `<path d="M0 -23 l-2 -3 l0.5 3.2 l-2.4 -1.4 l1.1 3 Q-1.4 -8 -1 -2 L1 -2 Q1.4 -8 1 -5 l2.4 -1.6 l-2.1 -0.4 l1.3 -2.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4" opacity="0.8"/>`,
  },
};
