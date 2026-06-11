import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'troll',
  label: "Troll (batracien)",
  order: 13,
  art: {
    front: `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="-2.4" cy="-5.8" r="0.9" fill="@peauH"/><circle cx="3.2" cy="-6.6" r="0.7" fill="@peauH"/><circle cx="6" cy="-2.6" r="0.8" fill="@peauH"/>
  <path d="M-6.2 -3.6 q2.2 -1.8 4.6 -0.8 M1.6 -4.4 q2.4 -1 4.6 0.8" stroke="@peauO" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="-3.8" cy="-1.6" rx="1.5" ry="1.6" fill="#e8d44a"/><circle cx="-3.8" cy="-1.4" r="0.8" fill="#160a04"/>
  <ellipse cx="3.8" cy="-1.6" rx="1.5" ry="1.6" fill="#e8d44a"/><circle cx="3.8" cy="-1.4" r="0.8" fill="#160a04"/>
  <path d="M-7.2 8 Q0 5.4 7.2 8 Q6.4 14.6 0 15.6 Q-6.4 14.6 -7.2 8 Z" fill="#1a0e06"/>
  <path d="M-6.3 8.3 l0.4 2.1 l1.2 -1.7 z M-4.4 7.7 l0.4 2.2 l1.2 -1.8 z M-2.3 7.3 l0.4 2.2 l1.2 -1.8 z M-0.2 7.2 l0.4 2.2 l1.2 -1.7 z M1.9 7.4 l0.4 2.1 l1.2 -1.7 z M3.9 7.8 l0.4 2 l1.1 -1.6 z M5.7 8.4 l0.4 1.8 l1 -1.5 z" fill="#e6ddc4"/>
  <path d="M-3.4 15 l0.5 -2 l1 1.6 z M0.4 15.4 l0.5 -2 l1 1.6 z M3.8 14.6 l0.5 -1.9 l0.9 1.5 z" fill="#e6ddc4"/>
</g>`,
    back: `<g>
  <path d="M-8 7 Q-9 -6 0 -8 Q9 -6 8 7 Q8 13 4 15 Q0 17 -4 15 Q-8 13 -8 7 Z" fill="@peauO"/>
  <path d="M-4 0 q4 -2 8 0" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
</g>`,
    profile: `<g>
  <path d="M-7 7 Q-8 -6 1 -8 Q9 -6 9 4 L11 7 Q11 13 6 15 Q2 17 -2 15 Q-7 13 -7 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <circle cx="-2.6" cy="-5.4" r="0.8" fill="@peauH"/><circle cx="2.6" cy="-6.2" r="0.7" fill="@peauH"/>
  <path d="M0.4 -4.2 q2.4 -1.2 4.6 0.4" stroke="@peauO" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="2.6" cy="-1.6" rx="1.4" ry="1.5" fill="#e8d44a"/><circle cx="2.8" cy="-1.4" r="0.75" fill="#160a04"/>
  <path d="M0.6 8.4 Q5.5 6.4 10.4 8.4 Q9.6 14.2 4.5 15 Q0.4 14.2 0.6 8.4 Z" fill="#1a0e06"/>
  <path d="M1.8 8.6 l0.4 2 l1.1 -1.6 z M4 8 l0.4 2.1 l1.1 -1.7 z M6.2 8 l0.4 2 l1.1 -1.6 z M8.3 8.5 l0.4 1.8 l1 -1.5 z" fill="#e6ddc4"/>
  <path d="M3.2 14.6 l0.5 -1.9 l1 1.5 z M6.4 14.4 l0.5 -1.8 l0.9 1.4 z" fill="#e6ddc4"/>
</g>`,
  },
};
