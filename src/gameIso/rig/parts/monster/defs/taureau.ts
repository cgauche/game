import type { MonsterPartDef } from '../types';
import { goatEye } from '../eyes';
import { OV_CORNES_TAUREAU } from '../../monsterOverlays';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'taureau',
  cornes: OV_CORNES_TAUREAU,
  label: "Taureau (minotaure)",
  order: 9,
  art: {
    front: `<g>
  <path d="M-10 -2 L-15 -7 Q-13 1 -8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M10 -2 L15 -7 Q13 1 8 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-9 -1 Q-10 -10 0 -11 Q10 -10 9 -1 Q9 8 4 12 L3 17 Q0 19 -3 17 L-4 12 Q-9 8 -9 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>
  <path d="M-6 6 Q0 4 6 6 Q7 12 3 16 Q0 18 -3 16 Q-7 12 -6 6 Z" fill="@peauH"/>
  <ellipse cx="-2.6" cy="15" rx="1.3" ry="1.6" fill="#1a0e06"/><ellipse cx="2.6" cy="15" rx="1.3" ry="1.6" fill="#1a0e06"/>
  ${goatEye(-3.4, 4, 1.7, 1.7)}${goatEye(3.4, 4, 1.7, 1.7)}
</g>`,
    back: `<g>
  <path d="M-10 -2 L-15 -7 Q-13 1 -8 3 Z" fill="@peauO"/><path d="M10 -2 L15 -7 Q13 1 8 3 Z" fill="@peauO"/>
  <path d="M-9 -1 Q-10 -10 0 -11 Q10 -10 9 -1 Q9 8 4 12 L3 17 Q0 19 -3 17 L-4 12 Q-9 8 -9 -1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 16" stroke="@peau" stroke-width="0.5" opacity="0.35"/>
</g>`,
    profile: `<g>
  <path d="M-4 -2 L-10 -7 Q-9 1 -3 3 Z" fill="@peauO"/>
  <path d="M-7 -1 Q-8 -10 2 -11 Q10 -10 10 -1 L14 3 Q15 10 11 16 L9 18 Q5 20 3 17 L2 12 Q-6 9 -7 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M10 14 Q12 16 11 18 Q9 18 8 16 Z" fill="@peauH"/>
  <ellipse cx="11" cy="15.5" rx="1.2" ry="1.5" fill="#1a0e06"/>
  ${goatEye(3, 3, 1.6, 1.6)}
</g>`,
  },
};
