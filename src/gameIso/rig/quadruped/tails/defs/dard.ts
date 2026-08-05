import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'dard',
  label: 'Dard (scorpion)',
  art: {
    // queue de SCORPION (manticore) : fouet SEGMENTÉ qui s'ARQUE à la VERTICALE derrière la croupe
    // puis crochète vers les ailes, bulbe terminal + DARD courbe. rotate(-42) compense l'os queue
    // (angle 42) → coordonnées en axes MONDE, -y = vers le haut ; filé vers -x le fouet sortait du
    // cadre 120×150 (pivot x≈10) → queue lue « lisse » en QC.
    profile: `<g transform="rotate(-42)">` +
      `<path d="M0 0 Q-3 -10 -2 -20 Q-1 -30 5 -36.5 Q8.5 -39.5 12 -39.5" fill="none" stroke="@corps" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M0 0 Q-3 -10 -2 -20 Q-1 -30 5 -36.5 Q8.5 -39.5 12 -39.5" fill="none" stroke="@corpsO" stroke-width="1.1" opacity="0.5" stroke-linecap="round"/>` +
      `<path d="M-4.8 -6 q3.2 1.2 6 0.6 M-5.6 -13 q3.4 1.2 6.2 0.5 M-5 -20 q3.3 1.1 6.2 0.4 M-4 -26.6 q3.2 1.2 6 0.6 M-1 -32.4 q2.8 1.6 5.4 1.2 M4 -36.8 q2 2 4.6 2.2" stroke="@corpsO" stroke-width="0.9" fill="none"/>` + // anneaux de segments
      `<circle cx="13" cy="-39.5" r="4.4" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // bulbe à venin
      `<path d="M15.8 -42.6 Q21.6 -47.8 23.4 -54.4 Q17.6 -50.8 14.4 -47.4 Q12.8 -44.6 15.8 -42.6 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.5"/>` + // le dard
      `</g>`,
    back: `<path d="M-2.6 0 Q-3.4 12 -1.6 24 Q0 28 1.6 24 Q3.4 12 2.6 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-2.1 6 l4.2 0 M-2.3 12 l4.6 0 M-1.8 18 l3.6 0" stroke="@corpsO" stroke-width="0.7"/><circle cx="0" cy="27" r="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M-1 29.6 Q-1.4 35 0 38.4 Q1.4 35 1 29.6 Z" fill="@cuir" stroke="#1a140e" stroke-width="0.4"/>`,
  },
};
