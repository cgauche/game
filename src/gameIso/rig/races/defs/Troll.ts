// Troll : grand, bras démesurés jusqu'au sol, petites jambes.
import type { RaceDef } from '../types';
import { OV_VERRUES } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Troll',
  gabarit: 'brute-bras-longs',
  palette: { peau: "#4a6b34", peauO: "#324a22", peauH: "#658a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  pose: { torse: 18, cou: 16, tete: -12, epauleG: 6, epauleD: 6 },
  career: 'Nu',
  head: 'troll',
  // Verrues + ventre pâle sur le torse (par-dessus la peau verte).
  features: [
    { bone: 'torse', svg: OV_VERRUES, scale: 'bone', layer: 98 },
  ],
};
