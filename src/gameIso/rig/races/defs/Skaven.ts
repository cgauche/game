// Skaven : homme-rat voûté élancé.
import type { RaceDef } from '../types';
import { OV_QUEUE_RAT } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Skaven',
  gabarit: 'elance-voute',
  palette: { peau: "#6f6354", peauO: "#4c4338", peauH: "#8c7f6c", cheveux: "#2a2018", cheveuxO: "#161009", cheveuxH: "#3a2c1e" },
  pose: { torse: 15, cou: 11, tete: -9, epauleG: 4, epauleD: 4 },
  tenue: 'Skaven',
  head: 'rat',
  // Longue queue rose en S — tell de silhouette du Skaven (derrière le bassin).
  features: [
    { bone: 'bassin', svg: OV_QUEUE_RAT, scale: 'bone', layer: -2 },
  ],
};
