// Ogre : brute colossale, épaules larges, jambes courtes.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Ogre',
  gabarit: 'brute',
  palette: { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  tenue: 'ogre', // tenue dédiée du registre (plaque-bedaine + cuirs) — « Nu » = corps seul
  head: 'ogre',
  // La PANSE est de la MORPHOLOGIE (corps nu) ; la plaque-bedaine/cuirs vivent dans tenues/defs/Ogre.ts.
  features: feat('panse'),
  pose: { torse: 6, cou: 6, tete: -4 },
};
