import type { MonsterPartDef } from '../types';
import { beastEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'caprin',
  label: "Caprine (homme-bête)",
  order: 8,
  art: {
    front: `<g>
  <path d="M-9 -1 L-13 -7 Q-12 0 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M9 -1 L13 -7 Q12 0 7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-7 1 Q-8 -8 0 -9 Q8 -8 7 1 Q6 8 4 11 L2 17 Q0 19 -2 17 L-4 11 Q-6 8 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-4 11 Q0 12 4 11 L3 16 Q0 18 -3 16 Z" fill="@peauO" opacity="0.4"/>
  <ellipse cx="0" cy="16.5" rx="1.6" ry="1.1" fill="#1a0e06"/>
  <path d="M-2.4 13 q2.4 1.3 4.8 0" stroke="#160a04" stroke-width="0.7" fill="none"/>
  <path d="M-1.6 13.4 l-0.3 1.8 l0.9 0 z M1.6 13.4 l0.3 1.8 l-0.9 0 z" fill="#efe6cf"/>
  ${beastEye(-3.2, 4, 1.6, 1.5)}${beastEye(3.2, 4, 1.6, 1.5)}
</g>`,
    back: `<g>
  <path d="M-9 -1 L-13 -7 Q-12 0 -7 2 Z" fill="@peauO"/><path d="M9 -1 L13 -7 Q12 0 7 2 Z" fill="@peauO"/>
  <path d="M-7 1 Q-8 -8 0 -9 Q8 -8 7 1 Q6 8 4 11 L2 17 Q0 19 -2 17 L-4 11 Q-6 8 -7 1 Z" fill="@peauO"/>
  <path d="M0 -8 L0 16" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-4 -1 L-9 -7 Q-9 0 -3 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-6 1 Q-7 -8 1 -9 Q8 -8 8 0 L11 4 Q12 9 9 13 L7 17 Q4 19 2 17 L1 12 Q-4 11 -6 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="9" cy="13" rx="1.4" ry="1" fill="#1a0e06"/>
  <path d="M5 13 q3 1.2 4 0" stroke="#160a04" stroke-width="0.7" fill="none"/>
  ${beastEye(2, 3, 1.5, 1.5)}
</g>`,
  },
};
