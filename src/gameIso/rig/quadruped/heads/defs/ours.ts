import type { QuadHeadDef } from '../types';
import { earsFront, eyeF, napeGeneric } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'ours',
  label: 'Ours',
  params: ['ears', 'mane', 'bodyLen'],
  art: {
    // tête d'OURS rugissant (artwork LDB p.317) : FRONT BOMBÉ, museau COURT et large (truffe
    // ramenée sous l'œil, fini le groin pointu), petites oreilles rondes, bajoues en lobes de
    // fourrure ARRONDIS (pas de mèches-piquants), gueule béante à 4 canines.
    profile: `<g transform="rotate(6)">` +
      `<path d="M-8.4 -4.6 q-3.6 -0.6 -5.2 1.6 q1.9 0.3 3.1 1.3 q-3 0.3 -4.4 2.3 q2.1 0.1 3.3 1.1 q-2.3 0.9 -3.1 2.9 q2.5 -0.3 4 0.7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // bajoue arrière en lobes ronds
      `<circle cx="0.4" cy="-9.4" r="2.2" fill="@corpsO"/>` + // oreille ronde lointaine
      `<path d="M-9.6 -3.6 Q-11.6 -7.6 -8.2 -9.6 Q-4.6 -11.4 0.6 -10.6 Q4.8 -10 7.6 -7.6 Q10.8 -5.2 12.8 -2.6 Q14.4 -0.8 13.6 0.4 Q12.4 1.6 9.4 1.7 Q6.4 1.8 4.2 2.5 Q0.6 3.6 -2.6 5.6 Q-6.2 7.6 -9 6.6 Q-11.4 5.4 -11.4 1.4 Q-11.4 -1.4 -9.6 -3.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // front bombé + museau court et large
      `<circle cx="-5.4" cy="-9" r="2.9" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="-5.4" cy="-8.8" r="1.3" fill="@corpsO"/>` + // petite oreille ronde plantée dans le crâne
      `<path d="M8.6 -2.8 q2 -0.7 3.7 -0.1 M7.8 -1.2 q2.3 -0.9 4.3 -0.2" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.7"/>` + // plis de rage sur le mufle
      `<path d="M-1 -10 Q4 -9.2 7.6 -6.9 Q10.8 -4.6 12.6 -2.2" stroke="@corpsH" stroke-width="1.6" fill="none" opacity="0.5"/>` + // chanfrein clair
      `<ellipse cx="13" cy="-1" rx="1.6" ry="1.4" fill="#120a06"/>` + // truffe large
      `<path d="M4.2 2.2 Q8.6 1.8 13.2 0.6 Q12.6 5.2 9.2 8 Q5.8 10 2.8 9 Q1.6 5.4 4.2 2.2 Z" fill="#6e120e"/>` + // gueule béante rouge sombre
      `<path d="M11.2 1 l0.8 3.2 l1.4 -2.9 Z M5.6 2.3 l0.7 2.8 l1.2 -2.5 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // 2 canines supérieures
      `<path d="M8.4 1.9 l0.3 1.4 M9.8 1.6 l0.3 1.3" stroke="#e8e0c8" stroke-width="0.6"/>` + // molaires discrètes
      `<path d="M-2 4.6 Q-0.2 10.4 5.4 12.4 Q10 13.8 12 11.8 Q8.6 11.2 6.2 9.8 Q2.6 7.6 0.8 3.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // mâchoire inférieure tombée, soudée à la bajoue
      `<path d="M6.8 10 l0.3 -2.4 l1.3 2 Z M9.8 11 l0.3 -2.3 l1.3 2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // 2 canines inférieures
      `<path d="M3.4 11.4 q-0.7 1.5 -0.3 2.9 M6.2 12.8 q-0.3 1.5 0.3 2.7" stroke="@cheveux" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>` + // barbe de gorge
      `<path d="M1.6 -6.8 Q4.2 -8 6.6 -6.2" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcil froncé
      `<g data-eye="D" data-ec="3.8 -4.8"><ellipse cx="3.8" cy="-4.8" rx="1.4" ry="1.6" fill="#15100a"/><circle cx="4.2" cy="-5.3" r="0.5" fill="#fff" opacity="0.7"/></g></g>`,
    // face d'OURS rugissant (artwork LDB p.317) : crâne large, bajoues hirsutes, gueule OUVERTE
    // sous la truffe (mâchoire tombée + crocs) — fini la bouche fermée neutre.
    front: (p) => `<g>${earsFront(p)}` +
      `<path d="M-11 -10 Q-13 4 -5 11 Q-2 13.4 0 13.4 Q2 13.4 5 11 Q13 4 11 -10 Q0 -14 -11 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-10.6 -2 l-3.4 1 l3 1.8 l-2.9 1.7 l3.4 1.1 M10.6 -2 l3.4 1 l-3 1.8 l2.9 1.7 l-3.4 1.1" stroke="@corps" stroke-width="1.7" fill="none" stroke-linejoin="round"/>` + // bajoues hérissées
      `<path d="M-6.2 -11.6 Q-4.6 -14 -2.4 -13 Q-1 -14.6 1 -14 Q2.6 -14.6 4 -13.2 Q5.4 -13.6 6.2 -11.6" stroke="@cheveux" stroke-width="1.2" fill="none" opacity="0.8" stroke-linecap="round"/>` + // couronne de fourrure arrondie
      `<path d="M-3.2 0 Q0 -1.4 3.2 0 L2.4 6 Q0 7.4 -2.4 6 Z" fill="@corpsH" opacity="0.4"/>` + // chanfrein clair
      `<ellipse cx="0" cy="6.4" rx="2.5" ry="1.8" fill="#120a06"/>` + // truffe
      `<path d="M-4.4 8.2 Q0 9.8 4.4 8.2 Q3.6 13.8 0 14.8 Q-3.6 13.8 -4.4 8.2 Z" fill="#6e120e" stroke="@corpsO" stroke-width="0.5"/>` + // gueule béante
      `<path d="M-3.3 8.9 l0.6 2.4 l1 -2.1 M3.3 8.9 l-0.6 2.4 l-1 -2.1" stroke="#e8e0c8" stroke-width="0.7" fill="none"/>` + // crocs supérieurs
      `<path d="M-1.5 14 l0.3 -2.1 l0.9 1.9 M1.5 14 l-0.3 -2.1 l-0.9 1.9" stroke="#e8e0c8" stroke-width="0.6" fill="none"/>` + // crocs inférieurs
      `<path d="M-7.2 -6 Q-4.6 -7.6 -2.2 -6 M2.2 -6 Q4.6 -7.6 7.2 -6" stroke="@corpsO" stroke-width="1.2" fill="none"/>` + // sourcils froncés
      `${eyeF(-4.6, -3.6, 1.5)}${eyeF(4.6, -3.6, 1.5)}</g>`,
    back: (p) => napeGeneric(p, { earsBig: true }),
  },
  bodyWidth: { front: 22, back: 26 },
  // bosse d'épaule saillante + pelage en touffes COUCHÉES (pas de piquants dressés — ils lisaient
  // « échine à pics ») + balafres de griffes à l'épaule (artwork LDB 78 p.317)
  bodyHi: (p) => {
    const bl = p.bodyLen;
    const X = (n: number) => (n * bl).toFixed(1);
    return `<path d="M${X(-2)} -25 Q${X(6)} -29.5 ${X(14)} -26.5 Q${X(20)} -24 ${X(22)} -20 Q${X(15)} -23.5 ${X(6)} -24 Q${X(0)} -24.5 ${X(-4)} -23 Z" fill="@corpsH" opacity="0.5"/>` + // bosse dorsale d'épaule
      `<path d="M${X(-30)} -16.5 q-3 0.6 -4.6 2.4 M${X(-22)} -19 q-3 0.4 -4.8 2 M${X(-14)} -20.5 q-3 0.3 -5 1.8 M${X(-6)} -22.5 q-3 0.2 -5 1.6 M${X(2)} -25.5 q-3 0.2 -5.2 1.4 M${X(10)} -25 q-3.2 0 -5.4 1.2 M${X(18)} -23 q-3 -0.2 -5.2 1" stroke="@corpsO" stroke-width="0.9" fill="none" opacity="0.5" stroke-linecap="round"/>` + // touffes couchées le long du dos
      `<path d="M${X(-38)} 6 l-2.2 2.6 M${X(-30)} 12 l-1.8 3 M${X(-20)} 16 l-1.2 3.2 M${X(-8)} 19 l-0.8 3.4 M${X(4)} 20 l-0.4 3.4 M${X(16)} 18 l0.2 3.2" stroke="@corpsO" stroke-width="1" stroke-linecap="round" opacity="0.55"/>` + // franges du ventre
      `<path d="M${X(-14)} -10 q3 5 2.4 11 M${X(-4)} -12 q3 5 2.4 11 M${X(6)} -13 q2.8 5 2.2 10 M${X(15)} -11 q2.6 4.6 2 9" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.35"/>` + // mèches de flanc
      `<path d="M${X(2)} -18 l7 9 M${X(7)} -19 l7 9 M${X(13)} -18 l6 8" stroke="#6e3226" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`; // balafres de griffes
  },
};
