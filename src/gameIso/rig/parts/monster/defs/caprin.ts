import type { MonsterPartDef } from '../types';
import { OV_CORNES_CAPRIN, OV_CORNES_CAPRIN_PROFILE } from '../../monsterOverlays';
import { goatEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'caprin',
  cornes: { front: OV_CORNES_CAPRIN, back: OV_CORNES_CAPRIN, profile: OV_CORNES_CAPRIN_PROFILE },
  label: "Caprine (homme-bête)",
  order: 8,
  art: {
    front: `<g>
  <path d="M-9 -1 L-13 -7 Q-12 0 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M9 -1 L13 -7 Q12 0 7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-7 1 Q-8 -8 0 -9 Q8 -8 7 1 Q6 8 4 11 L2 17 Q0 19 -2 17 L-4 11 Q-6 8 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-4 11 Q0 12 4 11 L3 16 Q0 18 -3 16 Z" fill="@peauO" opacity="0.4"/>
  <path d="M-1.5 13.2 q-0.45 1 0 1.9 M1.5 13.2 q0.45 1 0 1.9" stroke="#160a04" stroke-width="0.85" fill="none" stroke-linecap="round"/>
  <path d="M-2.5 16.4 Q0 17.8 2.5 16.4" stroke="#160a04" stroke-width="0.7" fill="none"/>
  <path d="M-2.4 16.5 l0.3 -1.7 l1 1.3 z M2.4 16.5 l-0.3 -1.7 l-1 1.3 z" fill="#efe6cf"/>
  ${goatEye(-3.2, 4, 1.6, 1.5)}${goatEye(3.2, 4, 1.6, 1.5)}
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
  ${goatEye(2, 3, 1.5, 1.5)}
</g>`,
  },
};
