import type { QuadHeadDef } from '../types';
import { earProfile, earsFront, eyeF, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'rat',
  label: 'Rat',
  params: ['ears', 'mane'],
  art: {
    profile: (p) => `<g transform="rotate(16)"><path d="M-6 -4 Q-8 5 -1 8 Q5 11 16 12 Q21 11 21 9 Q18 8 12 7 Q3 5 1 -3 Q0 -7 -6 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="20" cy="10" rx="1.5" ry="1.2" fill="#d8a0a0"/><ellipse cx="14" cy="6" rx="1.4" ry="1.7" fill="#1a0808"/><path d="M14 13 q-2 4 -4 2" fill="none" stroke="#e8e0c8" stroke-width="0.9"/>${earProfile(p, -4, -1)}${earProfile(p, 1, 1)}</g>`,
    front: (p) => `<g>${earsFront(p, { big: true })}<path d="M-7 -11 Q-9 2 -3 11 Q0 16 3 11 Q9 2 7 -11 Q0 -14 -7 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="13" rx="1.8" ry="1.5" fill="#d8a0a0"/><path d="M-2 13 q-5 1 -7 -1 M2 13 q5 1 7 -1 M-2 14 q-5 2 -8 1 M2 14 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.55"/>${eyeF(-4, -3, 1.4)}${eyeF(4, -3, 1.4)}</g>`,
    back: (p) => napeGeneric(p, { earsBig: true, earsInner: '#b88' }),
  },
  bodyWidth: { front: 14, back: 16 },
};
