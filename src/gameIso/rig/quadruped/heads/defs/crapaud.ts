import type { QuadHeadDef } from '../types';
import { napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'crapaud',
  label: 'Crapaud',
  params: ['ears', 'mane'],
  art: {
    // tête large et plate, GROS œil bombé doré sur le dessus, large bouche
    profile: `<g transform="rotate(2)"><path d="M-7 -2 Q-9 6 -1 9 Q8 12 16 9 Q20 7 19 1 Q12 -1 5 -2 Q-2 -3 -7 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-1" cy="-3.5" rx="4.2" ry="4" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-0.5" cy="-4" r="2.3" fill="#caa024"/><ellipse cx="-0.5" cy="-4" rx="0.7" ry="2.1" fill="#0a0603"/><circle cx="0.2" cy="-5" r="0.5" fill="#fff" opacity="0.7"/>` +
      `<path d="M3 7.5 Q10 10 17 7.5" stroke="@corpsO" stroke-width="1" fill="none"/>` +
      `<circle cx="7" cy="2" r="0.9" fill="@corpsO"/><circle cx="12" cy="4" r="0.8" fill="@corpsO"/><circle cx="4" cy="5" r="0.7" fill="@corpsO"/></g>`,
    // face TRÈS large, 2 gros yeux bombés écartés en haut, bouche très large
    front: `<g><path d="M-12 -6 Q-13 6 -6 13 Q0 16 6 13 Q13 6 12 -6 Q0 -10 -12 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="-7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><ellipse cx="7" cy="-7" rx="4.4" ry="4.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<circle cx="-7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="-7" cy="-7.5" r="1" fill="#0a0603"/><circle cx="7" cy="-7.5" r="2.4" fill="#caa024"/><circle cx="7" cy="-7.5" r="1" fill="#0a0603"/>` +
      `<path d="M-9 8 Q0 13 9 8" stroke="@corpsO" stroke-width="1.1" fill="none"/>` +
      `<circle cx="-3" cy="2" r="1" fill="@corpsO"/><circle cx="3" cy="3" r="0.9" fill="@corpsO"/><circle cx="0" cy="-1" r="0.8" fill="@corpsO"/></g>`,
    back: (p) => napeGeneric(p),
  },
};
