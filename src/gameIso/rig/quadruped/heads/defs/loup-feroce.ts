import type { QuadHeadDef } from '../types';
import { earProfile, earsFront, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'loup-feroce',
  label: 'Loup féroce',
  params: ['ears', 'mane', 'bodyLen'],
  art: {
    // tête de LOUP GRONDANT (artwork LDB 78 p.317) : même crâne bombé/museau cunéiforme que 'loup',
    // mais gueule GRANDE OUVERTE — babines retroussées plissées, rangées de crocs haut+bas,
    // mâchoire inférieure décrochée, œil ambre froncé. Tête DÉDIÉE au Loup (les félins qui
    // empruntent 'loup' gardent leur gueule fermée).
    profile: (p) => `<g transform="rotate(4)">` +
      // crâne + museau : la LÈVRE SUP s'arrête haut (y≈3.4), retroussée sur les crocs
      `<path d="M-8 -3 Q-9 -8.5 -2.5 -8 Q1.5 -7.6 3 -3.8 Q5.5 -2.6 9.5 -1.8 Q13.2 -1 14.2 1.2 Q14.4 3.2 12.2 3.6 Q9.6 3.8 7.6 3.3 Q6 3.9 4.6 3.4 L3.4 5.8 Q-0.5 8.8 -4.5 7.4 Q-9.2 5.2 -8 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M3 -3.4 Q8.5 -2.4 12.6 0.4" fill="none" stroke="@corpsH" stroke-width="1.5" opacity="0.5"/>` + // chanfrein clair
      `<path d="M-7 -4 Q-3 -1 -5.5 6" fill="none" stroke="@corpsH" stroke-width="1.6" opacity="0.4"/>` + // bajoue claire
      `<path d="M5.4 0 q2 -1 4 -0.6 M5 1.8 q2.4 -1 4.8 -0.5" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.75"/>` + // plis de rage (babine retroussée)
      `<ellipse cx="13.4" cy="1.4" rx="1.6" ry="1.3" fill="#120a06"/>` + // truffe
      // gueule BÉANTE rouge sombre + langue, entre les deux mâchoires
      `<path d="M4.4 3.6 Q8.5 4 12.4 3.8 Q11 8.6 7.6 10.4 Q4.6 10.4 3.4 7.6 Z" fill="#6e1410"/>` +
      `<path d="M4.6 7.6 Q7 9.2 9.6 8.4" stroke="#b03a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>` + // langue
      // mâchoire inférieure DÉCROCHÉE vers l'avant-bas, soudée à la bajoue
      `<path d="M-1.6 6.4 Q0.4 11.2 5 12.8 Q9.4 14 11.6 12.4 Q8.6 11.6 6.4 10.2 Q3 8.2 1.6 4.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      // crocs : rangée SUP pendante (4, canines longues) + rangée INF dressée (3)
      `<path d="M5.2 3.5 l0.7 2.9 l1.1 -2.6 Z M7.9 3.7 l0.8 3.2 l1.2 -2.9 Z M10.6 3.8 l0.6 2.7 l1 -2.4 Z M12.7 3.6 l0.5 2.2 l0.9 -2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` +
      `<path d="M4.4 9.6 l0.3 -2.6 l1.3 2.2 Z M6.9 10.9 l0.3 -2.7 l1.4 2.3 Z M9.4 11.7 l0.3 -2.4 l1.3 2.1 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` +
      earProfile(p, -5.5, -1) + earProfile(p, -0.5, 1) +
      `<path d="M-1.6 -4.6 Q0.8 -5.8 3 -4.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="0.6 -2.2"><ellipse cx="0.6" cy="-2.2" rx="1.7" ry="1.6" fill="#c47b1e"/><circle cx="0.9" cy="-2.2" r="0.7" fill="#15100a"/><circle cx="1.2" cy="-2.7" r="0.3" fill="#fff" opacity="0.7"/></g></g>`,
    // face du loup GRONDANT : même crâne/bajoues que 'loup', truffe remontée et gueule BÉANTE
    // dessous (mâchoire tombée sous le menton + crocs), yeux ambre froncés.
    front: (p) => `<g>${earsFront(p)}<path d="M-9 -13 Q-11 0 -6 8 Q-2 13 0 14 Q2 13 6 8 Q11 0 9 -13 Q0 -16 -9 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-8.6 -2 l-3.6 1.4 l3.2 1.8 l-3 1.6 l3.6 1 M8.6 -2 l3.6 1.4 l-3.2 1.8 l3 1.6 l-3.6 1" stroke="@corps" stroke-width="1.6" fill="none" stroke-linejoin="round"/>` + // bajoues hirsutes
      `<path d="M-4 -1 Q0 -2.5 4 -1 L2.8 9 Q0 11.5 -2.8 9 Z" fill="@corpsH" opacity="0.45"/>` + // chanfrein clair
      `<path d="M-3 6.6 q1.4 -0.8 2.8 -0.3 M0.2 6.3 q1.4 -0.5 2.8 0.3" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.7"/>` + // plis de babine
      `<ellipse cx="0" cy="10.6" rx="2.4" ry="1.9" fill="#120a06"/>` + // truffe
      `<path d="M-3.4 12.4 Q0 11.2 3.4 12.4 Q2.6 17.4 0 18.2 Q-2.6 17.4 -3.4 12.4 Z" fill="#6e1410" stroke="@corpsO" stroke-width="0.4"/>` + // gueule béante
      `<path d="M-2.5 12.7 l0.6 2.2 l0.9 -2 M0.6 12.5 l0.6 2.2 l0.9 -1.9" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs sup
      `<path d="M-1.3 17.6 l0.4 -1.8 l0.9 1.6 M1.2 17.5 l0.4 -1.7 l0.8 1.5" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inf
      `<path d="M-7.4 -6.4 Q-4.8 -7.8 -2.2 -6.2 M7.4 -6.4 Q4.8 -7.8 2.2 -6.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>` + // sourcils froncés
      `<g data-eye="G" data-ec="-5 -4"><ellipse cx="-5" cy="-4" rx="1.6" ry="1.5" fill="#c47b1e"/><circle cx="-5" cy="-4" r="0.65" fill="#15100a"/></g>` +
      `<g data-eye="D" data-ec="5 -4"><ellipse cx="5" cy="-4" rx="1.6" ry="1.5" fill="#c47b1e"/><circle cx="5" cy="-4" r="0.65" fill="#15100a"/></g></g>`,
    back: (p) => napeGeneric(p),
  },
  // pelage MÊLÉ du loup (artwork LDB 78 p.317) : POITRAIL beige, bande claire du bas de flanc/ventre
  // au-dessus de l'ombre, mèches sombres du dos.
  bodyHi: (p) => {
    const bl = p.bodyLen;
    const X = (n: number) => (n * bl).toFixed(1);
    return `<path d="M${X(24)} -8 Q${X(30)} -4 ${X(30)} 3 Q${X(29)} 9 ${X(25)} 12 Q${X(22)} 9 ${X(22)} 2 Q${X(22)} -4 ${X(24)} -8 Z" fill="@corpsH" opacity="0.45"/>` +
      `<path d="M${X(-16)} 1 Q${X(-6)} 4.5 ${X(4)} 8 Q${X(12)} 10.3 ${X(19)} 11 L${X(18)} 8.6 Q${X(10)} 7.6 ${X(2)} 5.2 Q${X(-8)} 2 ${X(-15)} -1 Z" fill="@corpsH" opacity="0.35"/>` +
      `<path d="M${X(-24)} -9.5 q2.6 3.4 2 7.6 M${X(-14)} -11.5 q2.6 3.6 2 8 M${X(-4)} -13 q2.6 3.6 2 8 M${X(6)} -13.8 q2.4 3.4 1.8 7.6 M${X(15)} -14.5 q2.2 3.2 1.6 7" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.4"/>`;
  },
};
