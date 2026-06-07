import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'lezard',
  label: "Reptilien",
  order: 2,
  art: {
    front: `<g>
  <path d="M-7 0 l-1 -7 l5 4 z" fill="@peauO"/><path d="M0 -2 l-1 -7 l2 1 z" fill="@peauO"/><path d="M7 0 l1 -7 l-5 4 z" fill="@peauO"/>
  <path d="M-7 2 Q0 -1 7 2 L3 13 L0 16 L-3 13 Z" fill="@peau"/>
  <path d="M-7 2 Q0 0 7 2" stroke="#3a5226" stroke-width="0.8" fill="none" opacity="0.6"/>
  <ellipse cx="-3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="-3" cy="5" r="0.8" fill="#1a1a08"/>
  <ellipse cx="3" cy="5" rx="1.7" ry="2.4" fill="url(#g_eye)"/><circle cx="3" cy="5" r="0.8" fill="#1a1a08"/>
  <line x1="-3" y1="13" x2="3" y2="13" stroke="#2a3a18" stroke-width="0.8"/>
  <circle cx="-1.4" cy="11" r="0.5" fill="#1a2410"/><circle cx="1.4" cy="11" r="0.5" fill="#1a2410"/>
</g>`,
    back: `<g>
  <path d="M-7 0 l-1 -7 l5 4 z" fill="@peauO"/><path d="M0 -2 l-1 -7 l2 1 z" fill="@peauO"/><path d="M7 0 l1 -7 l-5 4 z" fill="@peauO"/>
  <path d="M-7 2 Q0 -1 7 2 L3 13 L0 16 L-3 13 Z" fill="@peauO"/>
  <path d="M0 2 L0 14" stroke="#3a5226" stroke-width="0.8" opacity="0.5"/>
</g>`,
    profile: `<g>
  <path d="M-6 0 l-1 -7 l4 4 z M-1 -2 l0 -6 l3 3 z" fill="@peauO"/>
  <path d="M-6 2 Q-1 -2 4 1 L6 4 Q15 4 18 8 Q15 11 6 10 L2 14 L-2 15 L-6 12 Z" fill="@peau"/>
  <line x1="9" y1="9" x2="17" y2="9" stroke="#2a3a18" stroke-width="0.8"/>
  <ellipse cx="2" cy="5" rx="1.6" ry="2.2" fill="url(#g_eye)"/><circle cx="2" cy="5" r="0.8" fill="#1a1a08"/>
</g>`,
  },
};
