// Zombie : trapu voûté titubant.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Zombie',
  gabarit: 'trapu-voute',
  palette: { peau: "#8e8a7a", peauO: "#605c4d", peauH: "#a8a390", cheveux: "#454c36", cheveuxO: "#2c3024", cheveuxH: "#5a6248" },
  pose: { torse: 8, cou: 6, tete: -4 },
  tenue: 'mendiant',
  head: 'pourri',
  features: feat('plaie'),
};
