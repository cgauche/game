import type { QuadHeadDef } from '../types';
import { napeGeneric } from '../kit';
import { plumeFan } from '../../../parts/textures';

export const quadHead: QuadHeadDef = {
  key: 'aigle',
  label: 'Aigle',
  params: ['ears', 'mane'],
  art: {
    // tête emplumée + bec crochu jaune + œil féroce + sourcil saillant
    profile: `<g transform="rotate(5)"><path d="M-7 -6 Q-9 6 -2 10 Q4 13 11 11 Q15 9 14 4 Q9 4 4 2 Q-1 0 -2 -6 Q-3 -9 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M10 4 Q19 3 21 7 Q19 9 15 9 Q12 12 10 9 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.5"/><path d="M19 7 Q21.5 8 20 11 Q17.5 11 16 8.5 Z" fill="#c79a26" stroke="#7a5a18" stroke-width="0.4"/>` +
      `<path d="M10 9 Q14 10 17 9" stroke="#7a5a18" stroke-width="0.5" fill="none"/>` +
      `<ellipse cx="6" cy="1.6" rx="2" ry="2.1" fill="#e8b820"/><circle cx="6.5" cy="1.6" r="0.95" fill="#0a0603"/><circle cx="6.9" cy="1" r="0.3" fill="#fff" opacity="0.8"/>` +
      `<path d="M2 -1.4 Q6 -2.8 9.4 -0.6" stroke="@corpsO" stroke-width="1.3" fill="none"/>` +
      `<path d="M-7 -4 q-3 2 -4 6 M-6 -1 q-3 3 -3 7 M-4 2 q-3 3 -2 7" stroke="@corpsO" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>` +
      // collerette emplumée à la base du cou (textures.ts) — le tell « rapace » du griffon
      plumeFan(-6.5, 9, { n: 3, k: 0.8, baseRot: -125, colors: ['@corps', '@corpsO'] }) + `</g>`,
    // face emplumée + bec crochu central + 2 yeux féroces jaunes
    front: `<g><path d="M-8 -12 Q-10 4 -3 12 Q0 15 3 12 Q10 4 8 -12 Q0 -15 -8 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-2.4 8 L2.4 8 L1 15 Q0 17.2 -1 15 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.5"/><path d="M-1 14.6 Q0 17.2 1 14.6 L0.6 13 L-0.6 13 Z" fill="#9a7a28"/>` +
      `<ellipse cx="-4.4" cy="-0.4" rx="1.9" ry="2.1" fill="#e8b820"/><circle cx="-4.4" cy="-0.2" r="0.95" fill="#0a0603"/>` +
      `<ellipse cx="4.4" cy="-0.4" rx="1.9" ry="2.1" fill="#e8b820"/><circle cx="4.4" cy="-0.2" r="0.95" fill="#0a0603"/>` +
      `<path d="M-7.4 -3.4 Q-4.4 -5.4 -1.6 -3.2 M7.4 -3.4 Q4.4 -5.4 1.6 -3.2" stroke="@corpsO" stroke-width="1.3" fill="none"/>` +
      `<path d="M-8 -10 l-2.6 -3 M8 -10 l2.6 -3 M-6 -13 l-1.2 -3.4 M6 -13 l1.2 -3.4 M0 -14 l0 -3.4" stroke="@corpsO" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/></g>`,
    back: (p) => napeGeneric(p),
  },
};
