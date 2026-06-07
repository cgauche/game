import type { MonsterPartDef } from '../types';
import { beastEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'demon',
  label: "Démon (cornu, gueule)",
  order: 15,
  art: {
    front: `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-8 -4 Q0 -7 8 -4 Q6 -2 0 -2.5 Q-6 -2 -8 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M-6 9 Q0 8 6 9 Q5 16 0 17 Q-5 16 -6 9 Z" fill="#1a0a06"/>
  <path d="M-4.4 9.4 l-0.5 3 l1.2 0 z M-1.5 9.6 l0 3.6 M1.5 9.6 l0 3.6 M4.4 9.4 l0.5 3 l-1.2 0 z" fill="#efe6cf"/>
  <path d="M-3 13.6 l0.4 2.4 M3 13.6 l-0.4 2.4" stroke="#efe6cf" stroke-width="1.2" stroke-linecap="round"/>
  ${beastEye(-3.4, 3, 1.7, 1.7)}${beastEye(3.4, 3, 1.7, 1.7)}
</g>`,
    back: `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 14" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`,
    profile: `<g>
  <path d="M-7 1 Q-8 -10 1 -11 Q8 -10 8 -1 L11 1 Q12 6 9 8 L8 13 Q4 18 0 14 L-1 9 Q-7 7 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -4 Q1 -7 8 -3 Q6 -1 0 -2 Q-6 -2 -7 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M6 9 Q9 8 11 9 Q10 15 6 15 Q3 14 6 9 Z" fill="#1a0a06"/>
  <path d="M7 9.4 l0 3.4 M9.4 9.2 l0.3 3.2" stroke="#efe6cf" stroke-width="0.8"/>
  ${beastEye(3, 3, 1.6, 1.7)}
</g>`,
  },
};
