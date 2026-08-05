import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'touffe-basse',
  label: 'Touffe basse (loup)',
  art: {
    // queue de loup (artwork LDB p.317) : TOMBANTE derrière le corps (pas le crochet dressé de
    // 'touffe'), FOURNIE sur toute la longueur (bords en touffes), pointe sombre — l'os `queue`
    // penche à 42°, on redresse dans l'art (rotate -30 ⇒ ~12° de chute vers l'arrière).
    profile: `<g transform="rotate(-30)">` +
      `<path d="M-2.6 0 Q-4.6 7 -4 14 l1.8 -2.4 l-0.4 4.6 Q-2.4 22 -1 27 l1.4 -3 l0.8 4.6 Q3.4 26 5.6 21.4 l-1.8 0.4 l3 -5.2 Q7.6 12 6.4 6.4 Q5 1.4 2.6 -1 Q0 -2 -2.6 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-3.2 6 Q-2 14 1.4 20" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.45"/>` + // reflet clair du dessus
      `<path d="M0 24 Q1.2 27.6 3.4 28.6 Q5.6 26.4 6 22.6 l-2.2 1.4 l0.2 -3 Q2 22.6 0 24 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // pointe sombre
      `</g>`,
    // pend au centre, fournie (bords en touffes), pointe sombre
    back: `<path d="M-3.2 0 Q-4.4 10 -3 20 l1.2 -1.8 l0.4 4.4 Q0 25 1.6 22.4 l0.6 -3 l1.2 2 Q4.4 11 3.2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-1.4 20 Q0 26.4 1.8 20.6 Q0.4 19 -1.4 20 Z" fill="@cheveux"/>`,
  },
};
