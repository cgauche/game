import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'goule',
  label: "Goule (décharné, crocs)",
  order: 12,
  art: {
    front: `<g>
  <path d="M-7 2 Q-8 -10 0 -11 Q8 -10 7 2 Q6 8 3 10 L2 14 Q0 16 -2 14 L-3 10 Q-6 8 -7 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 4 Q-4.5 7 -3.4 10 M6 4 Q4.5 7 3.4 10" fill="none" stroke="@peauO" stroke-width="1" opacity="0.5"/>
  <ellipse cx="-3.2" cy="3" rx="2.3" ry="2.7" fill="#120e0a"/><ellipse cx="3.2" cy="3" rx="2.3" ry="2.7" fill="#120e0a"/>
  <circle cx="-3.2" cy="3.6" r="0.9" fill="#e8e6cf"/><circle cx="3.2" cy="3.6" r="0.9" fill="#e8e6cf"/>
  <circle cx="-3.1" cy="3.6" r="0.4" fill="#3a1410"/><circle cx="3.3" cy="3.6" r="0.4" fill="#3a1410"/>
  <path d="M-0.8 7 l0 1.8 M0.8 7 l0 1.8" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-5 11 Q0 10.4 5 11 Q4.4 14.6 0 15.4 Q-4.4 14.6 -5 11 Z" fill="#26120e"/>
  <path d="M-3.6 11 l0.8 2.3 l0.8 -2.3 Z M-0.5 11 l0.8 2.6 l0.8 -2.6 Z M2.4 11 l0.7 2.1 l0.7 -2.1 Z" fill="#e6ddc4"/>
  <path d="M-2.6 15 l0.5 -1.6 l0.6 1.6 M1 15 l0.5 -1.6 l0.6 1.6" fill="none" stroke="#e6ddc4" stroke-width="0.6"/>
  <path d="M-7 0 l-3.4 -3 l2.2 4.4 z M7 0 l3.4 -3 l-2.2 4.4 z" fill="@peau" stroke="@peauO" stroke-width="0.4"/>
</g>`,
    back: `<g>
  <path d="M-7 2 Q-8 -10 0 -11 Q8 -10 7 2 Q6 9 0 12 Q-6 9 -7 2 Z" fill="@peauO"/>
  <path d="M-6 -3 Q0 -5 6 -3" stroke="@peau" stroke-width="0.5" opacity="0.4" fill="none"/>
  <path d="M0 -8 L0 10" stroke="@peau" stroke-width="0.6" opacity="0.35"/>
  <path d="M-7 0 l-3.4 -3 l2.2 4.4 z M7 0 l3.4 -3 l-2.2 4.4 z" fill="@peauO"/>
</g>`,
    profile: `<g>
  <path d="M-6 2 Q-7 -10 1 -11 Q8 -10 8 0 L9 4 Q8 8 5 9 L5 13 Q2 15 0 13 L-1 10 Q-6 9 -6 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="2.2" cy="3" rx="2" ry="2.5" fill="#120e0a"/><circle cx="2.4" cy="3.6" r="0.8" fill="#e8e6cf"/><circle cx="2.5" cy="3.6" r="0.35" fill="#3a1410"/>
  <path d="M3 11 Q7 10.4 9 12 Q6.8 14 4 13.4 Z" fill="#26120e"/>
  <path d="M4 11.2 l0.4 1.9 M5.8 11 l0.5 2.1 M7.6 11.4 l0.4 1.7" stroke="#e6ddc4" stroke-width="0.6"/>
  <path d="M-6 -1 l-3.4 -3 l2.2 4.4 z" fill="@peau" stroke="@peauO" stroke-width="0.4"/>
</g>`,
  },
};
