// Minotaure : colossal, épaules surdimensionnées, jambes plus courtes que l'Ogre.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Minotaure',
  gabarit: 'brute',
  gabaritOverride: { sl: 1.32, legs: 0.9 },
  palette: { peau: "#6e4a2c", peauO: "#4a3220", peauH: "#c89a6e", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  tenue: 'nu',
  head: 'taureau',
  legs: 'chevre',
  features: feat('cornes-taureau', 'queue', 'pelage-massif'),
};
