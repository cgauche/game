import type { MonsterPartDef } from '../types';

// Tête d'HORREUR de Tzeentch (T1 ch.9 : « gueule béante hérissée de crocs ») : la tête EST
// la gueule — rictus démesuré sur toute la largeur, crocs irréguliers, yeux fous asymétriques.
export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'horreur',
  label: 'Horreur (gueule béante)',
  order: 16,
  art: {
    front: `<g>
  <path d="M-9 2 Q-10 -8 -3 -10 Q0 -12 3 -10 Q10 -8 9 2 Q9 10 5 14 Q0 17 -5 14 Q-9 10 -9 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-7.5 4 Q0 0.5 7.5 4 Q7 12 3.5 14.5 Q0 16 -3.5 14.5 Q-7 12 -7.5 4 Z" fill="#1c0a14"/>
  <path d="M-6.6 4.6 l-0.4 2.8 l1.5 -0.3 z M-3.8 3.6 l0 3.4 l1.6 -0.4 z M-0.6 3.3 l0.4 3.6 l1.5 -0.6 z M2.8 3.7 l0.8 3 l1.4 -0.8 z M5.6 4.7 l1 2.4 l0.8 -1.4 z" fill="#f2e8d4"/>
  <path d="M-5 13.6 l1 -2.6 l1.2 2.2 z M-1.4 14.8 l1 -2.8 l1.3 2.4 z M2.4 14 l0.9 -2.4 l1.2 2 z" fill="#f2e8d4"/>
  <path d="M-7.5 4 Q0 0.5 7.5 4" stroke="#0c0408" stroke-width="0.7" fill="none"/>
  <ellipse cx="-3.6" cy="-4" rx="2" ry="2.2" fill="#fff" /><circle cx="-3.2" cy="-3.6" r="1" fill="#180a10"/>
  <ellipse cx="3.4" cy="-5.4" rx="1.5" ry="1.7" fill="#fff"/><circle cx="3.7" cy="-5.2" r="0.75" fill="#180a10"/>
  <path d="M-6 -7.6 q2 -1.6 4.4 -0.8 M1.6 -8.4 q1.8 -1 3.6 -0.2" stroke="@peauO" stroke-width="0.7" fill="none"/>
</g>`,
    back: `<g>
  <path d="M-9 2 Q-10 -8 -3 -10 Q0 -12 3 -10 Q10 -8 9 2 Q9 10 5 14 Q0 17 -5 14 Q-9 10 -9 2 Z" fill="@peauO"/>
  <path d="M-5 -6 q2 3 0 7 M4 -7 q-1.6 3.4 0.4 6.6 M0 -10 q1 4 -0.5 8" stroke="@peau" stroke-width="0.6" fill="none" opacity="0.5"/>
</g>`,
    profile: `<g>
  <path d="M-7 1 Q-8 -8 -1 -10 Q4 -11 6 -8 L12 -4 Q15 -2 14 0 L4 2 Q9 3 13 6 Q15 8 13 10 L5 13 Q1 16 -3 13 Q-7 9 -7 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M4 2 L14 0 Q15 4 13 6 Q9 3.4 4 2.6 Z" fill="#1c0a14"/>
  <path d="M5.6 1.6 l0.6 -2 l1.2 1.7 z M8.6 1 l0.7 -1.8 l1.2 1.5 z M11.4 0.6 l0.7 -1.6 l1 1.3 z" fill="#f2e8d4"/>
  <path d="M6 3 l0.5 2 l1.2 -1.5 z M9 3.8 l0.6 1.8 l1.1 -1.3 z" fill="#f2e8d4"/>
  <ellipse cx="0" cy="-4.6" rx="1.9" ry="2.1" fill="#fff"/><circle cx="0.5" cy="-4.2" r="0.95" fill="#180a10"/>
  <path d="M-2.6 -7.8 q2.2 -1.4 4.6 -0.6" stroke="@peauO" stroke-width="0.7" fill="none"/>
</g>`,
  },
};
