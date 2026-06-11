import type { MonsterPartDef } from '../types';
import { emberEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'demon',
  label: "Démon (cornu, gueule)",
  order: 15,
  art: {
    front: `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-8 -4 Q0 -7 8 -4 Q6 -2 0 -2.5 Q-6 -2 -8 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M-5.6 9.2 Q0 8 5.6 9.2 Q5 14.6 0 15.4 Q-5 14.6 -5.6 9.2 Z" fill="#2a0806" stroke="#160404" stroke-width="0.5"/>
  <path d="M-4.4 9.6 l-0.4 3.2 l1.4 -0.4 z M4.4 9.6 l0.4 3.2 l-1.4 -0.4 z" fill="#efe6cf"/>
  <path d="M-2.2 9.5 l0.2 1.5 l0.9 -0.1 z M-0.4 9.4 l0.3 1.4 l0.9 -0.1 z M1.5 9.5 l0.3 1.3 l0.8 -0.2 z" fill="#e8dcc0"/>
  <path d="M-1.8 14.7 l0.4 -2 l0.9 1.3 z M1.8 14.7 l-0.4 -2 l-0.9 1.3 z" fill="#efe6cf"/>
  <path d="M-6.2 8.8 Q-5.2 7.9 -4 8.4 M6.2 8.8 Q5.2 7.9 4 8.4" stroke="#601010" stroke-width="0.7" fill="none"/>
  ${emberEye(-3.4, 3, 1.7)}${emberEye(3.4, 3, 1.7)}
</g>`,
    back: `<g>
  <path d="M-8 1 Q-9 -10 0 -11 Q9 -10 8 1 Q8 7 5 9 L4 14 Q0 18 -4 14 L-5 9 Q-8 7 -8 1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 14" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`,
    profile: `<g>
  <path d="M-7 1 Q-8 -10 1 -11 Q8 -10 8 -1 L11 1 Q12 6 9 8 L8 13 Q4 18 0 14 L-1 9 Q-7 7 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7 -4 Q1 -7 8 -3 Q6 -1 0 -2 Q-6 -2 -7 -4 Z" fill="#7a1f1c" opacity="0.85"/>
  <path d="M4.6 9.6 Q8 8.8 10.8 9.6 Q10 12.8 6.8 13.2 Q4.8 12.4 4.6 9.6 Z" fill="#2a0806" stroke="#160404" stroke-width="0.5"/>
  <path d="M9.6 9.8 l0.5 3.4 l1.3 -0.7 z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>
  <path d="M5.6 9.8 l0.3 1.6 l0.9 -0.2 z M7.4 9.8 l0.3 1.5 l0.9 -0.2 z" fill="#e8dcc0"/>
  <path d="M6.2 13 l0.4 -2 l1 1.3 z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>
  ${emberEye(3, 3, 1.6)}
</g>`,
  },
};
