// Ogre : brute colossale, épaules larges, jambes courtes.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Ogre',
  gabarit: 'brute',
  palette: { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  career: 'Ogre', // tenue dédiée du registre (plaque-bedaine + cuirs) — « Nu » = corps seul
  head: 'ogre',
  features: [
    // La PANSE est de la MORPHOLOGIE (corps nu), pas de la tenue : elle reste sur la race.
    // La plaque-bedaine, les épaulières de cuir et les bottes vivent dans tenues/defs/Ogre.ts.
    { bone: 'torse', scale: 'bone', layer: 50, svg:
      '<ellipse cx="0" cy="6" rx="15" ry="16" fill="@peau" stroke="@peauO" stroke-width="0.8"/>' },
  ],
  pose: { torse: 6, cou: 6, tete: -4 },
};
