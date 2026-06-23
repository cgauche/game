import type { AppearanceElement } from '../types';

// Coussinets ventousés visqueux : ronds concentriques luisants posés sur le creux des paumes
// (os main) et des plantes (os pied). Reflet clair au centre = aspect humide.
const VENTOUSE = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9fb89a" stroke="#5a7050" stroke-width="0.5"/>`
  + `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="#3e5238" stroke-width="0.4"/>`
  + `<circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.22}" fill="#e8f2e0" opacity="0.7"/>`;

// Sur la MAIN : trois ventouses au creux de la paume.
const MAIN = '<g data-mut="mains-et-pieds-a-ventouses">'
  + VENTOUSE(0, 0, 1.2) + VENTOUSE(-1.6, 1.4, 0.9) + VENTOUSE(1.6, 1.4, 0.9)
  + '</g>';
// Sur le PIED : deux grosses ventouses sous la plante.
const PIED = '<g data-mut="mains-et-pieds-a-ventouses">'
  + VENTOUSE(-1.3, 1, 1.3) + VENTOUSE(1.5, 1.4, 1.4)
  + '</g>';

export const element: AppearanceElement = {
  key: 'mains-et-pieds-a-ventouses', label: 'Mains et pieds à ventouses', category: 'mutation',
  overlays: [
    { bone: 'mainG', svg: MAIN, layer: 90 },
    { bone: 'mainD', svg: MAIN, layer: 90 },
    { bone: 'piedG', svg: PIED, layer: 90 },
    { bone: 'piedD', svg: PIED, layer: 90 },
  ],
};
