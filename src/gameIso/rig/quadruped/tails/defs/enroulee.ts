import type { QuadTailDef } from '../types';
import { QUEUE_BACK_REPTILE } from '../kit';

export const quadTail: QuadTailDef = {
  key: 'enroulee',
  label: 'Enroulée (dragon)',
  art: {
    // très longue queue qui s'ENROULE autour de la bête (dragon, artwork LDB 79 p.321) : plonge
    // derrière la croupe puis balaie le sol vers l'AVANT sous le corps, pointe retroussée devant le
    // poitrail — la 'reptile' qui traîne derrière sortait de la boîte 120×150. rotate(-42) annule
    // l'angle de l'os `queue` : l'art est authoré en axes MONDE (+x avant, +y sol).
    profile: `<g transform="rotate(-42)">` +
      `<path d="M-2 -8 C-16 8 -18 30 -10 47 C-4 59 14 65 34 65 C54 65 68 61 76 53 L83 43 Q74 47 68 51 C58 57 40 58 26 56 C12 54 2 45 1 34 C0.4 22 4 8 10 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-9 12 C-14 26 -13 40 -6 49" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5"/>` + // ombre du fouet descendant
      `<path d="M10 60 C34 63.5 58 61 72 53" fill="none" stroke="@corpsH" stroke-width="1.1" opacity="0.5"/>` + // reflet du dessus de l'anneau
      `<path d="M-11 20 l1.6 -3 M-12 30 l1.8 -2.8 M-9 40 l2 -2.6 M2 52 l1.8 -2.6 M16 59 l1.4 -2.8 M32 61 l1 -3 M48 60.5 l0.8 -3 M62 57 l0.6 -3" stroke="@corpsO" stroke-width="0.9" stroke-linecap="round"/>` + // anneaux d'écailles
      `<path d="M-14 14 l-5 -2.8 l4.4 -1.6 Z M-16 28 l-5.4 -0.6 l4.2 -2.6 Z M-12.5 42 l-4.6 2.2 l2.4 -4.4 Z M-4 54 l-3.2 3.8 l0.6 -5 Z M14 63 l-1.6 3.6 l-2.2 -4.4 Z M32 65.5 l-0.6 3.4 l-2.8 -3.8 Z M50 64 l0.2 3.4 l-3.2 -3 Z M66 58.5 l1.4 3 l-3.6 -1.4 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.35"/>` + // crête d'épines le long du bord externe
      `<path d="M83 43 L89 36 L81.5 38.5 Z" fill="@corpsO" stroke="#1a140e" stroke-width="0.4"/>` + // pointe en fer de lance retroussée
      `</g>`,
    back: QUEUE_BACK_REPTILE,
  },
};
