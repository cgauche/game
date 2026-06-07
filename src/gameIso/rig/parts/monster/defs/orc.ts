import type { MonsterPartDef } from '../types';
import { beastEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'orc',
  label: "Orc",
  order: 6,
  art: {
    front: `<g>
  <path d="M-8 3 Q-9 -8 0 -10 Q9 -8 8 3 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-8 -2 Q0 -6 8 -2 Q7 0 0 -0.5 Q-7 0 -8 -2 Z" fill="@peauO" opacity="0.55"/>
  <path d="M-2 8 Q0 7 2 8 Q9 9 9 12 Q5 14 0 13.5 Q-5 14 -9 12 Q-9 9 -2 8 Z" fill="@peauH"/>
  <ellipse cx="6.5" cy="10" rx="1.1" ry="0.8" fill="@peauO"/>
  <path d="M-2 12 l-0.3 -2.4 l1.2 0 l0.3 2.4 z M2 12 l0.3 -2.4 l-1.2 0 l-0.3 2.4 z" fill="#e8e0c8"/>
  <path d="M-4 13 q4 1.5 8 0" stroke="#3a2410" stroke-width="0.6" fill="none" opacity="0.5"/>
  ${beastEye(-3, 4, 1.4, 1.5)}${beastEye(3, 4, 1.4, 1.5)}
</g>`,
    back: `<g>
  <path d="M-8 3 Q-9 -8 0 -10 Q9 -8 8 3 Q9 11 4 14 Q0 16 -4 14 Q-9 11 -8 3 Z" fill="@peauO"/>
  <path d="M-3 -6 l1 18 m3 -18 l-1 18 m4 -17 l-1 16" stroke="#2f4a1e" stroke-width="0.6" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-7 3 Q-8 -8 1 -10 Q8 -8 8 0 L13 2 Q16 5 13 9 Q10 11 8 9 L7 12 Q3 15 -2 14 Q-7 11 -7 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -2 Q1 -6 8 -1 Q6 1 0 0 Q-6 0 -7 -2 Z" fill="@peauO" opacity="0.5"/>
  <path d="M9 11 q4 1.5 5 -0.5 Q12 12 9 11 Z" fill="@peauH"/>
  <path d="M9.5 11.5 l-0.3 -2 l1 0 l0.3 2 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.3, 1.4)}
</g>`,
  },
};
