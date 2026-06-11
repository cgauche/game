import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'bras',
  key: 'griffe',
  label: "Pince (griffe de crabe)",
  order: 2,
  art: `<g>
  <path d="M-2.8 -3 Q-4 8 -2.6 16 L2.6 16 Q4 8 2.8 -3 Q0 -4.6 -2.8 -3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-3.4 15 Q-5 19 -3.8 22 Q0 24 3.8 22 Q5 19 3.4 15 Q0 13.6 -3.4 15 Z" fill="@peau" stroke="@peauO" stroke-width="0.7"/>
  <path d="M-3.6 21 Q-7.5 25 -6.5 31 Q-5.5 35 -1.6 36 Q-3.6 31 -2.4 26 Q-1.8 23 -0.6 21.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>
  <path d="M1 21.6 Q4.8 24 4.6 29 Q4.4 32 2 33 Q3 29 1.8 25.6 Q1.2 23.4 0.2 22 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>
  <path d="M-5.8 26 q-0.6 3 0.6 5.4 M3.6 25 q0.6 2.4 -0.2 4.6" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.7"/>
</g>`,
};
