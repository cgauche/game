// Goule : maigre noueuse, semi-quadrupède, légèrement plus compacte.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Goule',
  gabarit: 'trapu-voute',
  gabaritOverride: { sl: 0.96, st: 0.92, legs: 0.9 },
  palette: { peau: "#9ca0a2", peauO: "#696d70", peauH: "#bcc0c2", cheveux: "#3a3e34", cheveuxO: "#22241e", cheveuxH: "#4e5246" },
  pose: { torse: 24, cou: 18, tete: -14, epauleG: 8, epauleD: 8 },
  tenue: 'nu',
  head: 'goule',
  features: feat('griffes'),
};
