import type { AppearanceElement } from '../types';

// Nuage de mouches : un essaim bourdonnant tourbillonne en permanence autour du corps — petits corps
// noirs luisants à ailes translucides, sillages de vol incurvés (mutation Nuage de mouches, EDOC).
// Halo posé sur torse (large) + tête (couronne) ; visible de partout (pas de view).

// une mouche : corps noir + reflet vert + deux ailes translucides
const fly = (x: number, y: number, r: number) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(0.9)">`
  + '<ellipse cx="0" cy="0" rx="0.85" ry="0.5" fill="#1c1810"/>'
  + '<circle cx="0.8" cy="0" r="0.4" fill="#2a2418"/>'
  + '<ellipse cx="0.5" cy="-0.2" rx="0.18" ry="0.14" fill="#3a6a2a" opacity="0.7"/>'
  + '<ellipse cx="-0.2" cy="-0.9" rx="0.9" ry="0.4" fill="#cdd6e0" opacity="0.35" transform="rotate(-28)"/>'
  + '<ellipse cx="-0.2" cy="0.9" rx="0.9" ry="0.4" fill="#cdd6e0" opacity="0.35" transform="rotate(28)"/>'
  + '</g>';

// sillage de vol (petit arc estompé)
const wake = (d: string) => `<path d="${d}" stroke="#2a2418" stroke-width="0.3" fill="none" opacity="0.3" stroke-linecap="round"/>`;

const TORSE = '<g data-mut="nuage-de-mouches">'
  + wake('M-9 0 q3 -2 5 0') + wake('M9 6 q-3 2 -5 0') + wake('M-6 14 q2 2 5 1')
  + fly(-9, -1, 18) + fly(-7, 6, -22) + fly(-8, 12, 40) + fly(-4, 18, -10)
  + fly(9, 1, 200) + fly(7, 8, 160) + fly(8, 15, -150) + fly(3, 20, 30)
  + fly(0, -3, 70) + fly(-2, 9, -60) + fly(4, 5, 120) + fly(1, 16, -90)
  + fly(6, -2, 10) + fly(-5, 2, 140)
  + '</g>';

const TETE = '<g data-mut="nuage-de-mouches">'
  + wake('M-8 -8 q3 -2 5 -1') + wake('M8 -10 q-3 -1 -5 1')
  + fly(-8, -7, 20) + fly(-5, -13, -30) + fly(0, -16, 60)
  + fly(6, -12, 150) + fly(9, -6, 200) + fly(3, -10, -70)
  + '</g>';

export const element: AppearanceElement = {
  key: 'nuage-de-mouches', label: 'Nuage de mouches', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: TORSE },
    { bone: 'tete', svg: TETE, layer: -2 },
  ],
};
