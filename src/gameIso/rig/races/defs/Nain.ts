// Nain : trapu et solide, jambes très courtes.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Nain',
  gabarit: 'courtaud',
  palette:  { cheveux: "#5a3a1e", peauO: "#d98e6a", peau: "#e0b48a", peauH: "#e9c39c", cheveuxO: "#54341a", cheveuxH: "#6a4423" },
  paletteF: { cheveux: "#7a5230", peau: "#e0b48a", peauO: "#d6a87c", cheveuxO: "#5e3412", cheveuxH: "#9a5a22" },
  // Grande barbe nourrie ANCRÉE À LA MÂCHOIRE (haut ~y9, sous les yeux) qui pend SOUS le menton —
  // tell #1 du nain. Tresses suggérées par deux sillons. Couleur @cheveux (suit la palette).
  features: [
    { bone: 'tete', scale: 'bone', layer: 10, svg:
      '<g>'
      + '<path d="M-9 8 Q-12 24 -5 32 Q0 35 5 32 Q12 24 9 8 Q5 13 0 13 Q-5 13 -9 8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>'
      + '<path d="M-5 15 Q0 18 5 15" fill="none" stroke="@cheveuxO" stroke-width="0.7"/>'
      + '<path d="M-3 18 L-3 30 M3 18 L3 30" stroke="@cheveuxO" stroke-width="0.6" opacity="0.7"/>'
      + '</g>' },
  ],
};
