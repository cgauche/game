import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'fouet',
  label: 'Fouet (fin, à floche)',
  art: {
    profile: `<path d="M0 0 Q6 8 5 18 Q4 22 6 24" fill="none" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" cy="24" r="1.6" fill="@cheveux"/>`,
    back: `<path d="M0 0 Q-1 9 0 18 Q1 22 0 24" fill="none" stroke="@corps" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="24" r="1.6" fill="@cheveux"/>`,
  },
};
