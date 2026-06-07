import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'pourri',
  label: "Chair pourrie (zombie)",
  order: 11,
  art: {
    front: `<g>
  <path d="M-7 3 Q-8 -9 0 -11 Q8 -9 7 3 Q7 9 4 11 L3 14 Q0 16 -3 14 L-4 11 Q-7 9 -7 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 -3 Q0 -6 6 -3 Q4 -1 0 -1.5 Q-4 -1 -6 -3 Z" fill="@peauO" opacity="0.5"/>
  <ellipse cx="-3" cy="3" rx="1.8" ry="2.2" fill="#0e0e08"/><ellipse cx="3" cy="3" rx="1.8" ry="2.2" fill="#0e0e08"/>
  <ellipse cx="0" cy="11.5" rx="2.6" ry="2.8" fill="#1c0e08"/>
  <path d="M-2 9.4 l0 4.2 M0 9 l0 4.6 M2 9.4 l0 4.2" stroke="#cabfa8" stroke-width="0.7"/>
  <path d="M-3 8 q3 -1 6 0" stroke="@peauO" stroke-width="0.7" fill="none" opacity="0.6"/>
</g>`,
    back: `<g>
  <path d="M-7 3 Q-8 -9 0 -11 Q8 -9 7 3 Q7 9 4 11 L3 14 Q0 16 -3 14 L-4 11 Q-7 9 -7 3 Z" fill="@peauO"/>
  <path d="M-3 -2 q3 -1 6 1 M-4 4 q4 0 7 1" stroke="#4a5236" stroke-width="0.6" opacity="0.5" fill="none"/>
</g>`,
    profile: `<g>
  <path d="M-6 3 Q-7 -9 1 -11 Q8 -9 8 0 L10 3 Q10 7 7 8 L6 12 Q3 15 0 13 L-1 10 Q-6 9 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2" cy="3" rx="1.7" ry="2.1" fill="#0e0e08"/>
  <ellipse cx="7" cy="9.5" rx="2.2" ry="2.4" fill="#1c0e08"/>
  <path d="M5.5 7.6 l0 3.8 M7.5 7.6 l0 3.8" stroke="#cabfa8" stroke-width="0.6"/>
</g>`,
  },
};
