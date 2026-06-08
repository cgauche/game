// Haut-Elfe : élancé et aristocratique, jambes longues.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Haut-Elfe',
  gabarit: 'elance',
  palette:  { peau: "#c69a72", peauO: "#b98a64", cheveux: "#6b4a30", peauH: "#d9a87e", cheveuxH: "#e6cf86", cheveuxO: "#a98521" },
  paletteF: { peau: "#ecc6a0", peauO: "#c79b75", cheveux: "#b88c38", cheveuxH: "#e6cd7e" },
  // Oreilles pointues aux tempes (niveau joue, sous le bord du heaume → lues comme oreilles, pas
  // ailerons) — tell de l'elfe (distinct de l'humain). Couleur @peau.
  features: [
    { bone: 'tete', scale: 'bone', layer: 3, svg:
      '<g>'
      + '<path d="M-8 7 Q-15 4 -14 -3 Q-11 1 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
      + '<path d="M8 7 Q15 4 14 -3 Q11 1 7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
      + '</g>' },
  ],
};
