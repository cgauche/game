import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'crane',
  label: "Crâne (squelette)",
  order: 10,
  art: {
    front: `<g>
  <path d="M-7 5 Q-9 -10 0 -12 Q9 -10 7 5 Q6 9 3 9 L3 13 Q0 16 -3 13 L-3 9 Q-6 9 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="-3.4" cy="3" rx="2.6" ry="3" fill="#160a06"/><ellipse cx="3.4" cy="3" rx="2.6" ry="3" fill="#160a06"/>
  <circle cx="-3.4" cy="3" r="1.1" fill="#e8861e"/><circle cx="3.4" cy="3" r="1.1" fill="#e8861e"/>
  <path d="M-1.4 7 l-0.6 2.4 l1.2 0 z" fill="#160a06"/>
  <path d="M-3 12 L3 12 M-2.2 9.5 L-2.2 13 M0 9.5 L0 13.5 M2.2 9.5 L2.2 13" stroke="@peauO" stroke-width="0.7"/>
  <rect x="-3" y="9.2" width="6" height="4.4" fill="none" stroke="@peauO" stroke-width="0.5"/>
</g>`,
    back: `<g>
  <path d="M-7 5 Q-9 -10 0 -12 Q9 -10 7 5 Q6 10 0 13 Q-6 10 -7 5 Z" fill="@peauO"/>
  <path d="M-5 0 Q0 -2 5 0" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
</g>`,
    profile: `<g>
  <path d="M-6 5 Q-8 -10 2 -12 Q9 -9 8 2 L9 6 Q8 10 4 10 L4 13 Q1 15 -2 13 L-3 9 Q-6 8 -6 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2.5" cy="3" rx="2.4" ry="2.8" fill="#160a06"/><circle cx="2.5" cy="3" r="1" fill="#e8861e"/>
  <path d="M6 7 l1.5 0.5 l-0.5 1.5 z" fill="#160a06"/>
  <path d="M1 12 L6 11 M2 9.5 L2 12.5 M4 9.2 L4 12" stroke="@peauO" stroke-width="0.6"/>
</g>`,
  },
};
