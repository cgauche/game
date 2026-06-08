// Elfe sylvain : élancé mais légèrement plus court et plus fin que le Haut-Elfe.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Elfe sylvain',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.05, st: 0.9 },
  palette:  { peau: "#cdbd92", peauO: "#a89464", peauH: "#d8c9a0", cheveux: "#3c2e1a", cheveuxH: "#6b7a3a", cheveuxO: "#4a3a22" },
  paletteF: { peau: "#d8c9a0", peauO: "#8a7a52", peauH: "#e2d2a8", cheveux: "#5a4a2c", cheveuxH: "#7a6642", cheveuxO: "#4a3c22" },
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
