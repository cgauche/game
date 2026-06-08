// Snotling : minuscule dodu, énorme tête de gremlin.
import type { RaceDef } from '../types';
import { OV_QUEUE } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Snotling',
  gabarit: 'gremlin-mini',
  palette: { peau: "#4a7a3a", peauO: "#326028", peauH: "#669a4e", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  career: 'Nu',
  head: 'gobelin',
  // Queue de pelage derrière le bassin.
  features: [
    { bone: 'bassin', svg: OV_QUEUE, scale: 'bone', layer: -2 },
  ],
};
