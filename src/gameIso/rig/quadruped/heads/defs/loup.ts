import type { QuadHeadDef } from '../types';
import { earProfile, earsFront, eyeF, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'loup',
  label: 'Loup',
  params: ['ears', 'mane'],
  art: {
    // crâne BOMBÉ court + stop marqué + museau effilé MODÉRÉ (≠ « banane »)
    profile: (p) => `<g transform="rotate(4)">` +
      `<path d="M-8 -3 Q-9 -8.5 -2.5 -8 Q1.5 -7.6 3 -3.8 Q5 -1.8 9 -1 Q12.5 -0.2 13.6 2.6 Q14 5 11.6 5.6 Q9 6 6 5.6 L4.2 7.8 Q0 10.6 -4.5 8.4 Q-9.2 5.6 -8 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M3 -3.4 Q8 -2.2 12 1.4" fill="none" stroke="@corpsH" stroke-width="1.5" opacity="0.5"/>` + // chanfrein clair (dessus du museau)
      `<path d="M-7 -4 Q-3 -1 -5.5 6" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.4"/>` + // bajoue claire
      `<ellipse cx="12.8" cy="3.6" rx="1.7" ry="1.4" fill="#120a06"/>` + // truffe
      `<path d="M6 5.6 Q9 6.8 12.2 4.8" stroke="@corpsO" stroke-width="0.6" fill="none"/>` + // ligne de gueule
      `<path d="M10.4 5.4 l0.35 1.4 l0.7 -1.2 Z" fill="#d8d0bc" opacity="0.85"/>` + // petit croc discret au coin de la gueule
      earProfile(p, -5.5, -1) + earProfile(p, -0.5, 1) +
      `<g data-eye="D" data-ec="0.6 -2"><ellipse cx="0.6" cy="-2" rx="1.7" ry="1.9" fill="#15100a"/><circle cx="1.1" cy="-2.6" r="0.6" fill="#fff" opacity="0.7"/></g></g>`,
    // bajoues de fourrure + museau CUNÉIFORME long + crocs — raccord avec le profil (le crâne rond
    // sans museau lisait « ours/rat » de face).
    front: (p) => `<g>${earsFront(p)}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8.6 -2 l-3.6 1.4 l3.2 1.8 l-3 1.6 l3.6 1 M8.6 -2 l3.6 1.4 l-3.2 1.8 l3 1.6 l-3.6 1" stroke="@corps" stroke-width="1.6" fill="none" stroke-linejoin="round"/>` + // bajoues hirsutes
      `<path d="M-4 -1 Q0 -2.5 4 -1 L2.8 11.5 Q0 14.5 -2.8 11.5 Z" fill="@corpsH" opacity="0.45"/>` +
      `<ellipse cx="0" cy="13.5" rx="2.5" ry="2" fill="#120a06"/>` +
      `<path d="M-2.4 15 l0.7 2.6 l1.1 -2.3 M2.4 15 l-0.7 2.6 l-1.1 -2.3" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs
      `${eyeF(-5, -4, 1.5)}${eyeF(5, -4, 1.5)}</g>`,
    back: (p) => napeGeneric(p),
  },
};
