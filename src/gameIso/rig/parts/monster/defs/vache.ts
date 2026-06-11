import type { MonsterPartDef } from '../types';
import { goatEye } from '../eyes';

// Tête de VACHE (basse-cour du Carnaval, Compagnon T1 ch.12) : large mufle rose à gros
// naseaux, oreilles tombantes ANCRÉES, petites cornes courtes — bovin placide, pas taureau.
export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'vache',
  label: 'Vache (basse-cour)',
  order: 10,
  art: {
    front: `<g>
  <path d="M-7 0 L-13 -3 Q-13.5 3 -8 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M7 0 L13 -3 Q13.5 3 8 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-5.5 -7 Q-8.5 -10 -7.5 -13 Q-4.5 -10.5 -3.5 -8 Z M5.5 -7 Q8.5 -10 7.5 -13 Q4.5 -10.5 3.5 -8 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>
  <path d="M-8 -1 Q-9 -9 0 -10 Q9 -9 8 -1 Q7.5 7 5 11 L3.5 17 Q0 19.5 -3.5 17 L-5 11 Q-7.5 7 -8 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-5 10 Q0 8.6 5 10 L4.4 16.4 Q0 19 -4.4 16.4 Z" fill="#d8a8a0" stroke="#a87870" stroke-width="0.5"/>
  <path d="M-2.2 13 q-0.6 1.2 0 2.4 M2.2 13 q0.6 1.2 0 2.4" stroke="#6e4640" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  ${goatEye(-3.6, 2.5, 1.6, 1.4)}${goatEye(3.6, 2.5, 1.6, 1.4)}
</g>`,
    back: `<g>
  <path d="M-7 0 L-13 -3 Q-13.5 3 -8 4 Z" fill="@peauO"/><path d="M7 0 L13 -3 Q13.5 3 8 4 Z" fill="@peauO"/>
  <path d="M-5.5 -7 Q-8.5 -10 -7.5 -13 Q-4.5 -10.5 -3.5 -8 Z M5.5 -7 Q8.5 -10 7.5 -13 Q4.5 -10.5 3.5 -8 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>
  <path d="M-8 -1 Q-9 -9 0 -10 Q9 -9 8 -1 Q7.5 7 5 11 L3.5 17 Q0 19.5 -3.5 17 L-5 11 Q-7.5 7 -8 -1 Z" fill="@peauO"/>
  <path d="M0 -9 L0 16" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-4 0 L-10 -2 Q-10.5 3.5 -5 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-1 -7.5 Q-3.5 -10.5 -2.5 -13 Q0.5 -10.5 1.5 -8 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>
  <path d="M-7 -1 Q-8 -9 1 -10 Q8 -8.5 8.5 -2 L11.5 4 Q12.5 9 10 13 L8 17 Q4 19.5 2 17 L1 11 Q-5 9.5 -7 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M5 10 Q9.5 8.6 12 10.5 Q12.4 15 9 16.8 Q5 17.5 4 14 Z" fill="#d8a8a0" stroke="#a87870" stroke-width="0.5"/>
  <path d="M9.6 12.4 q0.8 1 0.3 2.2" stroke="#6e4640" stroke-width="0.9" fill="none" stroke-linecap="round"/>
  ${goatEye(2.6, 1.5, 1.5, 1.3)}
</g>`,
  },
};
