import type { QuadManeDef } from '../types';

export const quadMane: QuadManeDef = {
  key: 'sans',
  label: 'Sans crinière',
  params: ['neckLen'],
  art: {
    // ligne de dos discrète le long de l'encolure (l'absence de crinière reste un trait, pas un vide)
    neck: (p) => {
      const L = 30 * p.neckLen;
      return `<path d="M-5 ${-L} Q-9 ${-L * 0.6} -8 2" fill="none" stroke="@cheveux" stroke-width="2.4" opacity="0.8"/>`;
    },
  },
};
