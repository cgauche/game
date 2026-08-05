import type { QuadHeadDef } from '../types';
import { earsFront, napeGeneric } from '../kit';

/** Collerette de crinière qui fait le tour du crâne, aussi de dos (manticore). */
const RUFF_BACK = `<path d="M0 -16 l-3.4 -3.4 l0.6 4 l-4.4 -2.4 l1.8 4 l-4.8 -0.6 l3 3.4 l-4.6 1.4 l4 2.2 l-3.2 3.4 l4.6 0 l-1.6 4.4 l4.2 -2.2 l0.6 4.6 l3.2 -3.6 l3.2 3.6 l0.6 -4.6 l4.2 2.2 l-1.6 -4.4 l4.6 0 l-3.2 -3.4 l4 -2.2 l-4.6 -1.4 l3 -3.4 l-4.8 0.6 l1.8 -4 l-4.4 2.4 l0.6 -4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5" transform="translate(0,-2)"/>`;

export const quadHead: QuadHeadDef = {
  key: 'felin',
  label: 'Félin',
  params: ['ears', 'mane'],
  art: {
    // gueule FÉLINE à CRINIÈRE (@cheveux) hérissée en couronne autour du crâne + museau court
    // retroussé + GRANDS CROCS débordants (manticore LDB 79 p.324, même langage que lionHeadlet)
    profile: `<g transform="rotate(6)">` +
      `<path d="M2 -9 L4.5 -15 L-1 -12.5 L-2 -18.5 L-6 -13.5 L-9.5 -18.5 L-10.5 -13 L-16 -15.5 L-14.5 -10 L-20 -10 L-16.5 -5.5 L-21.5 -2.5 L-16 -0.5 L-19.5 4 L-14 3.5 L-15.5 9.5 L-10.5 7 L-10 13 L-5.5 8.5 L-2.5 14 L0.5 8.5 L4 12 L4.5 6.5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.55"/>` + // crinière en couronne
      `<circle cx="-4" cy="-2" r="7.5" fill="@cheveuxO" opacity="0.32"/>` +
      `<path d="M-7 -6.5 Q-10.5 -1 -8.5 4.5 Q-6.5 8.5 -1.5 9 L1.5 8.2 Q3.5 9.8 7 9.4 Q10.5 9 11.5 6.8 Q13.4 6 13.2 3.8 Q13.6 1.6 11.8 0.6 Q8 -1 4.6 -1.6 Q2 -5.6 -1.8 -7.2 Q-4.8 -8.2 -7 -6.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M2.5 -2.5 Q7.5 -1.5 11.5 1.5" stroke="@corpsH" stroke-width="1.5" fill="none" opacity="0.5"/>` + // chanfrein clair
      `<path d="M5 1.4 q2.6 -0.6 5 0.6 M5.4 3.2 q2.8 -0.6 5.4 0.6" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.7"/>` + // babines retroussées
      `<ellipse cx="12.4" cy="3" rx="1.4" ry="1.1" fill="#120a06"/>` + // truffe
      `<path d="M3.5 7.5 Q7 12.5 12 11.6 Q13.8 10.4 12.8 8.8 Q8.5 9.6 5.6 7.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // mâchoire ouverte
      `<path d="M4 5.8 Q8 5 12.6 6.2 Q12.4 8.4 10.4 9.2 Q7 9.6 4.6 7.8 Z" fill="#5c0f0c"/>` +
      `<path d="M10.6 6.4 l0.9 4.6 l1.5 -4 Z M6.8 6.6 l0.8 3.6 l1.3 -3.1 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
      `<path d="M6 8.2 l0.3 -2.2 l0.9 2 M9.2 8.8 l0.3 -2.4 l1 2.1" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inférieurs
      `<circle cx="-5" cy="-8.5" r="2.8" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="-5" cy="-8.5" r="1.2" fill="@corpsO"/>` + // oreille ronde sur la crinière
      `<path d="M0.6 -5.6 Q3.4 -7 6 -5" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="3 -3"><ellipse cx="3" cy="-3" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="3.1" cy="-3" rx="0.6" ry="1.7" fill="#0a0603"/></g></g>`,
    // face féline : CRINIÈRE en couronne hérissée tout autour + museau court, gueule ouverte à
    // crocs pendants (raccord avec le profil felin)
    front: (p) => `<g>` +
      `<path d="M0 -17 L-3.4 -13.2 L-8 -15.6 L-7.6 -10.8 L-13.4 -11 L-10.8 -6.8 L-16.4 -4.6 L-11.6 -1.8 L-15.8 2.6 L-10.4 3 L-12.4 8.6 L-7.4 6.6 L-7.2 12.6 L-3.2 9 L-0.2 14.4 L2.8 9 L6.8 12.8 L7 6.8 L12 8.8 L10.2 3.2 L15.6 2.8 L11.4 -1.6 L16.2 -4.4 L10.6 -6.6 L13.2 -11 L7.4 -10.6 L7.8 -15.6 L3.4 -13.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.55"/>` + // crinière rayonnante
      `<circle cx="0" cy="-1" r="9.5" fill="@cheveuxO" opacity="0.3"/>` +
      `${earsFront(p)}<path d="M-8 -9 Q-10.5 -1 -7 5.5 Q-3.5 10.5 0 10.5 Q3.5 10.5 7 5.5 Q10.5 -1 8 -9 Q0 -12.5 -8 -9 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<ellipse cx="0" cy="6" rx="4.8" ry="3.8" fill="@corpsH" opacity="0.5"/>` + // museau clair
      `<path d="M-3 2.4 q3 -1.2 6 0 M-2.4 0.6 q2.4 -1 4.8 0" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.6"/>` + // babines froncées
      `<path d="M-1.7 4.6 L1.7 4.6 L0 7 Z" fill="#120a06"/>` + // truffe
      `<path d="M-3.6 8 Q0 10 3.6 8 Q2.6 13.6 0 14.2 Q-2.6 13.6 -3.6 8 Z" fill="#5c0f0c" stroke="@corpsO" stroke-width="0.4"/>` + // gueule ouverte
      `<path d="M-2.8 8.8 l0.7 3.6 l1.2 -3 Z M2.8 8.8 l-0.7 3.6 l-1.2 -3 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
      `<path d="M-7 -6 Q-4.4 -7.6 -1.8 -5.8 M7 -6 Q4.4 -7.6 1.8 -5.8" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcils froncés
      `<g data-eye="G" data-ec="-4.4 -3.4"><ellipse cx="-4.4" cy="-3.4" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="-4.4" cy="-3.3" rx="0.6" ry="1.7" fill="#0a0603"/></g>` +
      `<g data-eye="D" data-ec="4.4 -3.4"><ellipse cx="4.4" cy="-3.4" rx="1.8" ry="1.9" fill="#d8a020"/><ellipse cx="4.4" cy="-3.3" rx="0.6" ry="1.7" fill="#0a0603"/></g></g>`,
    back: (p) => napeGeneric(p, { ruff: RUFF_BACK }),
  },
};
