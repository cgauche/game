// Homme-bête : trapu musclé voûté, légèrement étiré en hauteur.
import type { RaceDef } from '../types';
import { OV_CORNES_CAPRIN, OV_QUEUE } from '../../parts/monstrous';
import { furPatch } from '../../parts/textures';
export const race: RaceDef = {
  id: 'Homme-bête',
  gabarit: 'trapu-massif',
  gabaritOverride: { sl: 1.02, st: 1.35, legs: 0.92 },
  palette: { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  pose: { torse: 14, cou: 12, tete: -9, epauleG: 5, epauleD: 5 },
  career: 'Nu',
  head: 'caprin',
  legs: 'chevre',
  // Cornes caprines ivoire derrière la tête ; queue de pelage derrière le bassin ;
  // PELAGE (textures.ts) sur le poitrail nu et les épaules — l'aplat de peau cesse de lire « lisse ».
  features: [
    { bone: 'tete',   svg: OV_CORNES_CAPRIN, scale: 'bone', layer: -2 },
    { bone: 'bassin', svg: OV_QUEUE,         scale: 'bone', layer: -2 },
    { bone: 'torse',   svg: furPatch(-7.5, 7.5, -19, 11, 3.2), scale: 'bone' },
    { bone: 'epauleG', svg: furPatch(-2.4, 2.4, 2, 24, 2.8),   scale: 'bone' },
    { bone: 'epauleD', svg: furPatch(-2.4, 2.4, 2, 24, 2.8),   scale: 'bone' },
  ],
};
