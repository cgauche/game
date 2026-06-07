import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'troll',
  label: "Troll (batracien)",
  order: 13,
  art: {
    front: `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="-4" cy="-1" r="3.4" fill="#f2c84a"/><circle cx="-4" cy="-1" r="1.4" fill="#160a04"/>
  <circle cx="4" cy="-1" r="3.4" fill="#f2c84a"/><circle cx="4" cy="-1" r="1.4" fill="#160a04"/>
  <path d="M-7 9 Q0 7 7 9 Q6 15 0 16 Q-6 15 -7 9 Z" fill="#1a0e06"/>
  <path d="M-5 9.4 l-0.6 3.4 l1.4 0 z M-1.8 10 l0 4 M1.8 10 l0 4 M5 9.4 l0.6 3.4 l-1.4 0 z" fill="#e6ddc4"/>
  <path d="M-4 13.6 l0 2.2 M4 13.6 l0 2.2" stroke="#e6ddc4" stroke-width="1.4" stroke-linecap="round"/>
</g>`,
    back: `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peauO"/>
  <path d="M-4 0 q4 -2 8 0" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
</g>`,
    profile: `<g>
  <path d="M-7 7 Q-8 -6 1 -8 Q9 -6 9 4 L11 7 Q11 13 6 15 Q2 17 -2 15 Q-7 13 -7 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="2" cy="-1" r="3.2" fill="#f2c84a"/><circle cx="2" cy="-1" r="1.3" fill="#160a04"/>
  <path d="M1 9 Q6 7 10 9 Q9 15 4 15 Q0 14 1 9 Z" fill="#1a0e06"/>
  <path d="M3 9.4 l0 3.6 M6 9 l0 4 M8.6 9.4 l0.4 3.2" stroke="#e6ddc4" stroke-width="0.8"/>
</g>`,
  },
};
