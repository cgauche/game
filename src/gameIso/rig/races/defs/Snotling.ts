// Snotling : minuscule dodu, énorme tête de gremlin.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Snotling',
  gabarit: 'gremlin-mini',
  palette: { peau: "#4a7a3a", peauO: "#326028", peauH: "#669a4e", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  tenue: 'nu',
  head: 'gobelin',
  features: feat('queue'),
};
