import type { AppearanceElement } from '../types';

// Exophtalmie : deux yeux globuleux saillant hors des orbites — grosses sclères bombées, iris cerclé,
// pupille dilatée, reflet vif, paupière inférieure rouge et distendue (mutation Exophtalmie, EDOC).
// Os tête, face.
const eye = (cx: number) => ''
  // poche de paupière inférieure rougie et tendue
  + `<ellipse cx="${cx}" cy="0.4" rx="3" ry="2.9" fill="#caa07a" stroke="#9a5a4a" stroke-width="0.5"/>`
  // globe saillant (sclère bombée)
  + `<circle cx="${cx}" cy="-0.6" r="2.6" fill="#f2ece0" stroke="#8a6a4a" stroke-width="0.5"/>`
  // iris
  + `<circle cx="${cx}" cy="-0.4" r="1.5" fill="#7a5a2a" stroke="#4a3414" stroke-width="0.4"/>`
  // pupille dilatée
  + `<circle cx="${cx}" cy="-0.4" r="0.8" fill="#120c06"/>`
  // reflet vif
  + `<circle cx="${cx - 0.7}" cy="-1.1" r="0.45" fill="#ffffff" opacity="0.85"/>`
  // veinule rouge sur la sclère
  + `<path d="M${cx + 1.6} -1.4 q-0.8 0.4 -1.4 0.2 M${cx - 1.8} 0 q0.7 0.3 1.3 0.1" stroke="#c0524a" stroke-width="0.3" fill="none" opacity="0.7"/>`;

const YEUX = `<g data-mut="exophtalmie">${eye(-3.4)}${eye(3.4)}</g>`;

export const element: AppearanceElement = {
  key: 'exophtalmie', label: 'Exophtalmie', category: 'mutation',
  overlays: [{ bone: 'tete', svg: YEUX, view: 'front' }],
};
