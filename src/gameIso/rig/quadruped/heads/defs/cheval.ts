import type { QuadHeadDef } from '../types';
import { EYE_PROFILE, earProfile, earsFront, eyeF, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'cheval',
  label: 'Cheval',
  params: ['ears', 'mane'],
  art: {
    profile: (p) => `<g transform="rotate(8)"><path d="M-7 -6 Q-9 6 -3 12 Q4 20 12 22 Q18 22 19 17 Q18 12 12 10 Q4 6 2 -4 Q0 -9 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M12 10 Q18 12 19 17 Q18 20 14 20 Q10 18 11 12 Z" fill="@corpsO"/><ellipse cx="16" cy="17" rx="2" ry="1.5" fill="#1a0f08"/>${earProfile(p, -5, -1)}${earProfile(p, 0, 1)}<path d="M-6 -4 Q-2 -7 1 -3" fill="none" stroke="@cheveux" stroke-width="2" opacity="0.8"/>${EYE_PROFILE}</g>`,
    front: (p) => `<g>${earsFront(p)}<path d="M-7 -14 Q-9 6 -4 16 Q0 19 4 16 Q9 6 7 -14 Q0 -17 -7 -14 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/><path d="M-2 -15 Q0 -17 2 -15 L1.5 12 Q0 14 -1.5 12 Z" fill="@cheveux" opacity="0.6"/><ellipse cx="0" cy="13" rx="4.2" ry="3.2" fill="@corpsO"/><ellipse cx="-1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/><ellipse cx="1.6" cy="13" rx="0.9" ry="1.3" fill="#140a06"/>${eyeF(-5, -2)}${eyeF(5, -2)}</g>`,
    back: (p) => napeGeneric(p),
  },
};
