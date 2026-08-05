import type { QuadHeadDef } from '../types';
import { napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'dragon',
  label: 'Dragon',
  params: ['ears', 'mane'],
  art: {
    // long museau écailleux + cornes en arrière + crête + dents + œil fendu
    profile: `<g transform="rotate(8)"><path d="M-8 -6 Q-10 7 -2 11 Q4 14 16 13 Q24 12 26 8 Q22 7 14 6 Q3 4 1 -4 Q0 -9 -8 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-6 -5 q-4 -8 -11 -10 q4 6 6 12 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/><path d="M-2 -6 q-3 -9 -9 -12 q3 7 5 13 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` +
      `<ellipse cx="23" cy="9.4" rx="1.3" ry="1" fill="#1a0e08"/>` +
      `<path d="M13 12 l0.8 2.2 M17 12 l0.8 2.2 M21 11 l0.6 1.8" stroke="#e8e0c8" stroke-width="0.7"/>` +
      `<ellipse cx="4" cy="1.6" rx="1.8" ry="2.1" fill="#d8b820"/><ellipse cx="4" cy="1.6" rx="0.5" ry="1.9" fill="#0a0603"/>` +
      `<path d="M-8 -6 l-2 -4 M-3.5 -6.6 l-1 -4 M1 -5.6 l-0.4 -4" stroke="@corpsO" stroke-width="1.5" stroke-linecap="round"/></g>`,
    // face reptilienne : cornes FINES balayées (les larges lisaient « oreilles d'âne ») + MUSEAU
    // ALLONGÉ à dents débordantes et naseaux en fente (fini le groin de cochon) — raccord avec le
    // profil (même gueule longue, mêmes dents, même œil fendu).
    front: `<g><path d="M-5.5 -11 q-1.6 -8.5 -7 -12.5 q1.2 7 3.2 13.5 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/><path d="M5.5 -11 q1.6 -8.5 7 -12.5 q-1.2 7 -3.2 13.5 z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` +
      `<path d="M-9 -10 Q-11 3 -5 9 Q0 12 5 9 Q11 3 9 -10 Q0 -14 -9 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-4.6 7 Q-5.4 15 -3 19.5 Q0 21.6 3 19.5 Q5.4 15 4.6 7 Q0 9.5 -4.6 7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // museau long
      `<path d="M-4.6 10.5 l1.1 2 l1.2 -1.8 M4.6 10.5 l-1.1 2 l-1.2 -1.8 M-3.8 14.5 l1 1.9 l1.1 -1.7 M3.8 14.5 l-1 1.9 l-1.1 -1.7" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // dents débordantes
      `<path d="M-2.2 18.6 l1.1 -1.8 M2.2 18.6 l-1.1 -1.8" stroke="#1a0e08" stroke-width="0.8" stroke-linecap="round"/>` + // naseaux en fente
      `<ellipse cx="-5" cy="-2" rx="1.8" ry="2.3" fill="#d8b820"/><ellipse cx="-5" cy="-2" rx="0.5" ry="2.1" fill="#0a0603"/>` +
      `<ellipse cx="5" cy="-2" rx="1.8" ry="2.3" fill="#d8b820"/><ellipse cx="5" cy="-2" rx="0.5" ry="2.1" fill="#0a0603"/>` +
      `<path d="M0 -13 l0 -3.4 M-3 -12 l-0.6 -3.4 M3 -12 l0.6 -3.4" stroke="@corpsO" stroke-width="1.3" stroke-linecap="round"/></g>`,
    back: (p) => napeGeneric(p),
  },
};
