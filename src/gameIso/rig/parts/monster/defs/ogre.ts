import type { MonsterPartDef } from '../types';
import { beastEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'ogre',
  label: "Ogre (prognathe)",
  order: 14,
  art: {
    front: `<g>
  <path d="M-9 3 Q-10 -8 0 -10 Q10 -8 9 3 Q9 11 5 14 Q0 17 -5 14 Q-9 11 -9 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="0" cy="11.5" rx="6.5" ry="4.2" fill="@peauO" opacity="0.45"/>
  <path d="M-1.6 6.5 q1.6 -1 3.2 0" stroke="@peauO" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="-2.4" cy="8.5" rx="1.1" ry="0.8" fill="@peauO"/><ellipse cx="2.4" cy="8.5" rx="1.1" ry="0.8" fill="@peauO"/>
  <path d="M-5 12 q5 2 10 0" stroke="#3a2410" stroke-width="0.7" fill="none" opacity="0.5"/>
  <path d="M-3.4 12.6 l-0.4 -3 l1.3 0 l0.4 3 z M3.4 12.6 l0.4 -3 l-1.3 0 l-0.4 3 z" fill="#e8e0c8"/>
  ${beastEye(-3.6, 4, 1.6, 1.7)}${beastEye(3.6, 4, 1.6, 1.7)}
</g>`,
    back: `<g>
  <path d="M-9 3 Q-10 -8 0 -10 Q10 -8 9 3 Q9 11 5 14 Q0 17 -5 14 Q-9 11 -9 3 Z" fill="@peauO"/>
  <path d="M0 -9 L0 15" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`,
    profile: `<g>
  <path d="M-8 3 Q-9 -8 1 -10 Q9 -8 9 0 L13 3 Q14 8 11 12 L9 14 Q4 17 0 14 Q-8 11 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="9" cy="11" rx="3.6" ry="3" fill="@peauO" opacity="0.4"/>
  <ellipse cx="11" cy="9.5" rx="1" ry="0.8" fill="@peauO"/>
  <path d="M7 12.5 l-0.4 -2.6 l1.2 0 l0.4 2.6 z" fill="#e8e0c8"/>
  ${beastEye(3, 3, 1.5, 1.6)}
</g>`,
  },
};
