// Zombie : trapu voûté titubant.
import type { RaceDef } from '../types';
import { OV_PLAIE } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Zombie',
  gabarit: 'trapu-voute',
  palette: { peau: "#8e8a7a", peauO: "#605c4d", peauH: "#a8a390", cheveux: "#454c36", cheveuxO: "#2c3024", cheveuxH: "#5a6248" },
  pose: { torse: 8, cou: 6, tete: -4 },
  tenue: 'Mendiant',
  head: 'pourri',
  // Plaie de chair rouge exposée sur le torse (par-dessus la peau).
  features: [
    { bone: 'torse', svg: OV_PLAIE, scale: 'bone', layer: 98 },
  ],
};
