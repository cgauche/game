// Fimir : proportions d'ogre (carrure brute) mais sans les traits cosmétiques Ogre
// (heaume/pauldrons/gut-plate propres à l'Ogre). Sa tête (cyclope) et sa couleur de peau
// viennent de son creature def via perso.monster + perso.colors.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Fimir',
  gabarit: 'brute',
  palette: { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  career: 'Nu',
};
