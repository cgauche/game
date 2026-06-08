// Homme-bête : trapu musclé voûté, légèrement étiré en hauteur.
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Homme-bête',
  gabarit: 'trapu-massif',
  gabaritOverride: { sl: 1.02, st: 1.35, legs: 0.92 },
  palette: { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  pose: { torse: 14, cou: 12, tete: -9, epauleG: 5, epauleD: 5 },
  career: 'Nu',
  monster: { tete: 'caprin', cornes: true, jambes: 'chevre', queue: true },
};
