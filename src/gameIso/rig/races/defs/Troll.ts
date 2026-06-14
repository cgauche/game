// Troll : grand, bras démesurés jusqu'au sol, petites jambes.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Troll',
  gabarit: 'brute-bras-longs',
  palette: { peau: "#4a6b34", peauO: "#324a22", peauH: "#658a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  pose: { torse: 18, cou: 16, tete: -12, epauleG: 6, epauleD: 6 },
  tenue: 'Nu',
  head: 'troll',
  features: feat('verrues'),
};
