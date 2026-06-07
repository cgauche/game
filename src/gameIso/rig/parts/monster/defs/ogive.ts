import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'ogive',
  label: "Tête en ogive",
  order: 3,
  art: {
    front: `<g>
  <path d="M-7 9 Q-8 -12 0 -17 Q8 -12 7 9 Q0 14 -7 9 Z" fill="@peau"/>
  <path d="M-7 9 Q0 12 7 9" stroke="@peauO" stroke-width="0.6" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="-3" cy="6" r="0.8" fill="#140a06"/>
  <ellipse cx="3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="6" r="0.8" fill="#140a06"/>
  <path d="M-3 11 q3 2 6 0" stroke="#7a5a3a" stroke-width="1" fill="none"/>
</g>`,
    back: `<g>
  <path d="M-7 9 Q-8 -12 0 -17 Q8 -12 7 9 Q0 14 -7 9 Z" fill="@peauO"/>
  <path d="M0 -16 L0 12" stroke="@peauO" stroke-width="0.6" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-6 9 Q-7 -11 1 -16 Q9 -11 7 9 Q1 13 -6 9 Z" fill="@peau"/>
  <ellipse cx="3" cy="6" rx="1.5" ry="2.1" fill="url(#g_eye)"/><circle cx="3" cy="6" r="0.8" fill="#140a06"/>
  <path d="M4 11 q3 1 4 -1" stroke="#7a5a3a" stroke-width="0.9" fill="none"/>
</g>`,
  },
};
