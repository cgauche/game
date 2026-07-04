import type { MonsterPartDef } from '../types';
import { beastEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'gobelin',
  cornes: 'cornes-caprin',
  label: "Gobelin",
  order: 7,
  art: {
    front: `<g>
  <path d="M-9 -2 L-22 -14 Q-20 -2 -12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M9 -2 L22 -14 Q20 -2 12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-12 -10 L-18 -13 Q-16 -7 -11 -4 Z" fill="@peauO" opacity="0.5"/>
  <path d="M12 -10 L18 -13 Q16 -7 11 -4 Z" fill="@peauO" opacity="0.5"/>
  <path d="M-10 1 Q-11 -11 0 -12 Q11 -11 10 1 Q9 11 0 15 Q-9 11 -10 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="0" cy="9" rx="6" ry="3.2" fill="@peauO" opacity="0.45"/>
  <path d="M-4 9 q4 2.5 8 0" stroke="#1c0f06" stroke-width="0.9" fill="none"/>
  <path d="M-2 9.6 l-0.4 2.6 l1.2 0 z M2 9.6 l0.4 2.6 l-1.2 0 z" fill="#e8e0c8"/>
  ${beastEye(-3.5, 3, 1.8, 1.9)}
  <path d="M2 2 q3 1 5.5 0" stroke="@peauO" stroke-width="1.3" fill="none" stroke-linecap="round"/>
</g>`,
    back: `<g>
  <path d="M-9 -2 L-22 -14 Q-20 -2 -12 4 Z" fill="@peauO"/><path d="M9 -2 L22 -14 Q20 -2 12 4 Z" fill="@peauO"/>
  <path d="M-10 1 Q-11 -11 0 -12 Q11 -11 10 1 Q9 11 0 15 Q-9 11 -10 1 Z" fill="@peauO"/>
  <path d="M0 -10 L0 13" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-2 -2 L-14 -14 Q-14 -2 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-9 1 Q-10 -11 1 -12 Q9 -11 9 -2 L13 0 Q16 3 13 6 Q10 7 8 5 L7 8 Q3 15 -3 13 Q-9 11 -9 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M8 5 q3 1.5 5 0" stroke="#1c0f06" stroke-width="0.8" fill="none"/>
  <path d="M9 5.5 l-0.3 2.2 l1 0 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.6, 1.8)}
</g>`,
  },
};
