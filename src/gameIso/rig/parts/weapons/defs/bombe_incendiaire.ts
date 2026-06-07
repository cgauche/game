import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "bombe_incendiaire",
  label: "Bombe incendiaire",
  type: "ranged",
  group: "Explosifs",
  target: "pot/bombe à feu, flamme et huile qui dégoulinent",
  art: "<path d='M0 6 C-12 6 -12 -8 -7 -13 L-4 -16 L4 -16 L7 -13 C12 -8 12 6 0 6 Z' fill='@cuir' stroke='#33200f' stroke-width='1'/><path d='M-9 -4 C-9 4 -4 8 0 8 C4 8 9 4 9 -4 C6 1 0 2 -4 1 C-7 0 -8 -2 -9 -4 Z' fill='@cuirO' opacity='0.65'/><ellipse cx='-3.6' cy='-7' rx='3.2' ry='4.6' fill='@cuirH' opacity='0.55'/><path d='M-4.6 -16 L-5.4 -22 L5.4 -22 L4.6 -16 Z' fill='@cuirO' stroke='#33200f' stroke-width='0.7'/><ellipse cx='0' cy='-22' rx='5.4' ry='1.7' fill='@cuir' stroke='#33200f' stroke-width='0.6'/><path d='M-5.2 -20 Q-9 -19 -8 -23 Q-4 -25 -5.2 -20 Z M5.2 -20 Q9 -19 8 -23 Q4 -25 5.2 -20 Z' fill='@cuir' opacity='0.85'/><path d='M-3 -22 Q-7 -27 -3 -33 Q-1 -29 -2.5 -26 Q1 -28 3 -34 Q5 -28 1.5 -24 Z' fill='url(#g_eye)'/><path d='M-1.5 -26 Q-5 -33 -1 -42 Q1.5 -35 -0.5 -31 Q2.5 -35 2.5 -43 Q5.5 -33 1.5 -27 Z' fill='url(#g_eye)' opacity='0.95'/><path d='M0 -34 Q-2.5 -41 0.5 -50 Q2.5 -42 1 -38 Q2.5 -42 2 -47 Q4.5 -40 1 -33 Z' fill='@accentO'/><circle cx='0.4' cy='-37' r='1.8' fill='@accent'/><path d='M-9 -1 Q-13 6 -11 12 Q-9 16 -8 12 Q-7 7 -9 1 Z' fill='url(#g_eye)'/><path d='M-10.2 7 Q-11 12 -10 14 Q-9 15 -8.6 11 Z' fill='@accentO'/><circle cx='-9.6' cy='16' r='1.6' fill='url(#g_eye)'/><circle cx='-9.6' cy='16' r='0.7' fill='@accentO'/><path d='M8.6 0 Q13 6 11 13 Q9 17 8 13 Q7 6 8.6 0 Z' fill='url(#g_eye)' opacity='0.92'/><path d='M9.6 8 Q10.4 13 9.4 15 Q8.4 15 8.2 11 Z' fill='@accentO'/><circle cx='9.4' cy='17' r='1.4' fill='url(#g_eye)'/><path d='M-2 7 Q-3 11 -2 13 Q-1 11 -2 7 Z' fill='url(#g_eye)' opacity='0.8'/><circle cx='4.5' cy='11' r='1.2' fill='url(#g_eye)' opacity='0.85'/>",
  palette: {"cuir":"#6e4326","cuirO":"#4a2c16","cuirH":"#9c6638","accentO":"#ffd34d","accent":"#fff3c0"},
};
