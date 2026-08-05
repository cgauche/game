import type { QuadManeDef } from '../types';

export const quadMane: QuadManeDef = {
  key: 'crin',
  label: 'Crin couché (équine)',
  params: ['neckLen'],
  art: {
    // crin COUCHÉ retombant sur l'encolure : masse + mèches
    neck: (p) => {
      const L = 30 * p.neckLen;
      return `<path d="M-4 ${-L - 2} Q-14 ${-L * 0.78} -13 ${-L * 0.34} Q-12.5 ${-L * 0.06} -10 4 Q-9 4.5 -7.5 4 Q-9.5 ${-L * 0.36} -2 ${-L * 0.9} Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
        `<path d="M-11.5 ${-L * 0.62} Q-10.5 ${-L * 0.4} -10.6 ${-L * 0.18} M-9.4 ${-L * 0.78} Q-8.6 ${-L * 0.5} -9 ${-L * 0.26} M-7 ${-L * 0.9} Q-6.4 ${-L * 0.6} -7.2 ${-L * 0.4}" fill="none" stroke="@cheveuxO" stroke-width="0.7" opacity="0.7"/>`;
    },
  },
};
