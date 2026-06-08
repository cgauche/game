// Homme-bête : trapu musclé voûté, légèrement étiré en hauteur.
import type { RaceDef } from '../types';
import { OV_CORNES_CAPRIN, OV_QUEUE } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Homme-bête',
  gabarit: 'trapu-massif',
  gabaritOverride: { sl: 1.02, st: 1.35, legs: 0.92 },
  palette: { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  pose: { torse: 14, cou: 12, tete: -9, epauleG: 5, epauleD: 5 },
  career: 'Nu',
  head: 'caprin',
  legs: 'chevre',
  // Cornes caprines ivoire derrière la tête ; queue de pelage derrière le bassin.
  features: [
    { bone: 'tete',   svg: OV_CORNES_CAPRIN, scale: 'bone', layer: -2 },
    { bone: 'bassin', svg: OV_QUEUE,         scale: 'bone', layer: -2 },
  ],
};
