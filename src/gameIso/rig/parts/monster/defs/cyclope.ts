import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'cyclope',
  label: "Cyclope (œil unique)",
  order: 16,
  art: {
    front: `<g>
  <path d="M-8 2 Q-9 -9 0 -11 Q9 -9 8 2 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -1 Q0 -5 7 -1 Q5 1 0 0.4 Q-5 1 -7 -1 Z" fill="@peauO" opacity="0.6"/>
  <ellipse cx="0" cy="3.6" rx="3.7" ry="3.3" fill="#e8e0c8"/><circle cx="0" cy="4" r="1.9" fill="#b8451c"/><circle cx="0" cy="4" r="0.95" fill="#0a0603"/><circle cx="0.8" cy="3.2" r="0.5" fill="#fff" opacity="0.7"/>
  <path d="M-4 11 Q0 13 4 11 Q3 14.4 0 14.8 Q-3 14.4 -4 11 Z" fill="#1c0f06"/>
  <path d="M-2.6 11.2 l0 2.4 M0 11.6 l0 2.6 M2.6 11.2 l0 2.4" stroke="#e8e0c8" stroke-width="0.6"/>
</g>`,
    back: `<g>
  <path d="M-8 2 Q-9 -9 0 -11 Q9 -9 8 2 Q8 11 0 14 Q-8 11 -8 2 Z" fill="@peauO"/>
  <path d="M0 -9 L0 13" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`,
    profile: `<g>
  <path d="M-7 2 Q-8 -9 1 -11 Q9 -9 9 0 L12 2 Q13 7 10 10 L8 13 Q4 16 0 13 Q-7 11 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="3" cy="3.6" rx="3" ry="3.1" fill="#e8e0c8"/><circle cx="3.4" cy="4" r="1.6" fill="#b8451c"/><circle cx="3.4" cy="4" r="0.8" fill="#0a0603"/>
  <path d="M5 11 Q9 10 11 11 Q9 14 5 14 Q3 13 5 11 Z" fill="#1c0f06"/>
  <path d="M6 11.2 l0 2.4 M8.4 11 l0 2.6" stroke="#e8e0c8" stroke-width="0.6"/>
</g>`,
  },
};
