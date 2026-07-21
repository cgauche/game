import type { MonsterPartDef } from '../types';

// Tête de PRIMATE (singe) — crâne rond bombé, yeux FRONTAUX rapprochés (binoculaires),
// museau court et plat, FACE nue plus claire (#c89a7a) cerclée du pelage @peau,
// petites oreilles rondes latérales. Queue déclarée : générique (longue, recourbée).
export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'singe',
  queue: 'queue-generique',
  label: 'Singe',
  order: 24,
  art: {
    front: `<g>
  <circle cx="-10" cy="1" r="3.4" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="-10" cy="1" r="1.8" fill="#c89a7a"/>
  <circle cx="10" cy="1" r="3.4" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="10" cy="1" r="1.8" fill="#c89a7a"/>
  <path d="M-9 2 Q-10 -10 0 -11 Q10 -10 9 2 Q8 11 0 14 Q-8 11 -9 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 1 Q-6 -4 0 -4.5 Q6 -4 6 1 Q6 9 0 11.5 Q-6 9 -6 1 Z" fill="#c89a7a" stroke="#a87a5c" stroke-width="0.5"/>
  <path d="M-5.5 -1 Q-3 -3 -0.8 -1.5 M0.8 -1.5 Q3 -3 5.5 -1" stroke="#a87a5c" stroke-width="0.6" fill="none"/>
  <circle cx="-2.8" cy="2" r="1.9" fill="#2a1708"/><circle cx="2.8" cy="2" r="1.9" fill="#2a1708"/>
  <circle cx="-2.3" cy="1.4" r="0.55" fill="#fff" opacity="0.8"/><circle cx="3.3" cy="1.4" r="0.55" fill="#fff" opacity="0.8"/>
  <ellipse cx="0" cy="7.5" rx="3.6" ry="2.6" fill="#b8886a" opacity="0.75"/>
  <circle cx="-1.1" cy="6.8" r="0.5" fill="#6a4630"/><circle cx="1.1" cy="6.8" r="0.5" fill="#6a4630"/>
  <path d="M-2.4 9.4 q2.4 1.6 4.8 0" stroke="#5a3a24" stroke-width="0.7" fill="none" stroke-linecap="round"/>
</g>`,
    back: `<g>
  <circle cx="-10" cy="1" r="3.4" fill="@peauO"/><circle cx="10" cy="1" r="3.4" fill="@peauO"/>
  <path d="M-9 2 Q-10 -10 0 -11 Q10 -10 9 2 Q8 11 0 14 Q-8 11 -9 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M0 -10 Q-4 -2 -2 12 M0 -10 Q4 -2 2 12" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.5"/>
</g>`,
    profile: `<g>
  <circle cx="-6" cy="1" r="3.2" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="-6" cy="1" r="1.7" fill="#c89a7a"/>
  <path d="M-8 2 Q-9 -10 1 -11 Q9 -9 9 0 Q9.5 3 11 5 Q12.5 7.5 10 9.5 Q7 11.5 3 12 Q-7 11 -8 2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M4 -1 Q9 -1 10.5 4 Q12 7 9.5 9 Q6.5 10.8 3.5 10.5 Q1.5 6 4 -1 Z" fill="#c89a7a" stroke="#a87a5c" stroke-width="0.5"/>
  <circle cx="5.8" cy="2.4" r="1.7" fill="#2a1708"/><circle cx="6.3" cy="1.9" r="0.5" fill="#fff" opacity="0.8"/>
  <circle cx="10.6" cy="6" r="0.45" fill="#6a4630"/>
  <path d="M7.5 8.8 q1.8 0.7 3 0" stroke="#5a3a24" stroke-width="0.6" fill="none" stroke-linecap="round"/>
  <path d="M4 -2 Q6 -4 8 -2.5" stroke="#a87a5c" stroke-width="0.5" fill="none"/>
</g>`,
  },
};
