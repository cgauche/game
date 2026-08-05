import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'touffe',
  label: 'Touffe (dressée)',
  art: {
    profile: `<path d="M0 0 Q10 6 13 18 Q15 28 9 31 Q12 22 6 14 Q2 7 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M11 16 Q16 24 10 30 Q12 22 8 16 Z" fill="@cheveux"/>`,
    back: `<path d="M-3 0 Q-4 12 -2 24 Q0 28 2 24 Q4 12 3 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-2 14 Q0 26 2 14 Z" fill="@cheveux"/>`,
  },
};
