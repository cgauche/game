import type { QuadHeadDef } from '../types';
import { EYE_PROFILE, earProfile, earsFront, eyeF, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'sanglier',
  label: 'Sanglier',
  params: ['ears', 'mane'],
  art: {
    profile: (p) => `<g transform="rotate(10)"><path d="M-7 -4 Q-9 6 0 10 Q9 13 15 11 Q19 9 17 5 Q12 4 8 3 Q1 2 0 -4 Q-1 -8 -7 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="15" cy="8" rx="3" ry="3.4" fill="@corpsO"/><ellipse cx="15" cy="8" rx="1" ry="1.4" fill="#140a06"/><path d="M12 11 q-2 5 -5 3" fill="none" stroke="#e8e0c8" stroke-width="1.6" stroke-linecap="round"/>${earProfile(p, -5, -1)}${earProfile(p, 0.5, 1)}${EYE_PROFILE}</g>`,
    // groin large + défenses
    front: (p) => `<g>${earsFront(p)}<path d="M-10 -10 Q-12 5 -5 12 Q0 16 5 12 Q12 5 10 -10 Q0 -13 -10 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><ellipse cx="0" cy="12" rx="5.2" ry="3.6" fill="@corpsO"/><ellipse cx="-2" cy="12" rx="1" ry="1.4" fill="#140a06"/><ellipse cx="2" cy="12" rx="1" ry="1.4" fill="#140a06"/><path d="M-4 14 Q-6 19 -3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/><path d="M4 14 Q6 19 3 19" fill="none" stroke="#e8e0c8" stroke-width="1.5" stroke-linecap="round"/>${eyeF(-6, -3, 1.4)}${eyeF(6, -3, 1.4)}</g>`,
    back: (p) => napeGeneric(p),
  },
  bodyWidth: { front: 19, back: 23 },
  chestCrest: `<path d="M-3 -26 Q0 -33 3 -26 M-6 -24 Q-3 -30 0 -25 M0 -25 Q3 -30 6 -24" stroke="@cheveux" stroke-width="1.3" fill="none" opacity="0.8"/>`,
};
