import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'chien',
  label: "Chien / loup",
  order: 1,
  art: {
    front: `<g>
  <path d="M-6 5 l-5.5 -13 l9.5 7 z" fill="@peauO"/><path d="M6 5 l5.5 -13 l-9.5 7 z" fill="@peauO"/>
  <path d="M-8 1 Q0 -3 8 1 L4 12 L0 16 L-4 12 Z" fill="@peau"/>
  <path d="M-4 11 L0 15 L4 11 L2 13 L-2 13 Z" fill="@peauO"/>
  <ellipse cx="-3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="4" rx="1.6" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="4" r="0.8" fill="#140a06"/>
  <ellipse cx="0" cy="15" rx="1.7" ry="1.3" fill="#1a0e06"/>
</g>`,
    back: `<g>
  <path d="M-8 2 l-3 -11 l8 5 z" fill="@peau"/><path d="M8 2 l3 -11 l-8 5 z" fill="@peau"/>
  <path d="M-8 1 Q0 -3 8 1 L4 13 L0 16 L-4 13 Z" fill="@peauO"/>
  <path d="M-3 4 l1 9 m3 -9 l-1 9 m4 -9 l-1 8" stroke="#4a3018" stroke-width="0.7" opacity="0.5"/>
</g>`,
    profile: `<g>
  <path d="M-4.5 3 l-4.5 -12 l8.5 5.5 z" fill="@peauO"/>
  <path d="M-7 2 Q-2 -3 5 1 L7 5 Q14 5 16 9 Q14 12 7 11 L3 14 L-1 15 L-6 12 Z" fill="@peau"/>
  <ellipse cx="16" cy="9" rx="1.8" ry="1.4" fill="#1a0e06"/>
  <ellipse cx="2" cy="5" rx="1.5" ry="2" fill="url(#g_eye)"/><circle cx="2" cy="5" r="0.8" fill="#140a06"/>
  <path d="M9 10 q4 1 6 0" stroke="#1a0e06" stroke-width="0.7" fill="none"/>
</g>`,
  },
};
