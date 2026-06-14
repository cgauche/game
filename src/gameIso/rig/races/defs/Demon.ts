// Démon : élancé nerveux, membres longs.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Démon',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.06, legs: 1.06 },
  palette: { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" },
  tenue: 'Nu',
  head: 'demon',
  legs: 'chevre', // jambes digitigrades (illustration LDB p.337 : sabots/pattes bestiales)
  features: feat('cornes-demon', 'muscles-torse'),
};
