// Fimir : proportions d'ogre (carrure brute) mais sans les traits cosmétiques Ogre.
// Tête cyclope + queue + cuir écailleux (race dédiée mono-consommateur).
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Fimir',
  gabarit: 'brute',
  palette: { peau: "#6b7a52", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" }, // chair gris-vert de vase
  tenue: 'nu',
  head: 'cyclope',
  features: feat('queue', 'ecailles'),
};
