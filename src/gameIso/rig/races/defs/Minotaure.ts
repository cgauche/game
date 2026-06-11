// Minotaure : colossal, épaules surdimensionnées, jambes plus courtes que l'Ogre.
import type { RaceDef } from '../types';
import { OV_CORNES_TAUREAU, OV_QUEUE } from '../../parts/monstrous';
import { furPatch } from '../../parts/textures';
export const race: RaceDef = {
  id: 'Minotaure',
  gabarit: 'brute',
  gabaritOverride: { sl: 1.32, legs: 0.9 },
  palette: { peau: "#6e4a2c", peauO: "#4a3220", peauH: "#c89a6e", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  career: 'Nu',
  head: 'taureau',
  legs: 'chevre',
  // Cornes bovines en V derrière la tête ; queue de pelage derrière le bassin ;
  // PELAGE (textures.ts) sur le poitrail et les épaules massives.
  features: [
    { bone: 'tete',   svg: OV_CORNES_TAUREAU, scale: 'bone', layer: -2 },
    { bone: 'bassin', svg: OV_QUEUE,           scale: 'bone', layer: -2 },
    { bone: 'torse',   svg: furPatch(-8, 8, -20, 12, 3.4), scale: 'bone' },
    { bone: 'epauleG', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
    { bone: 'epauleD', svg: furPatch(-2.6, 2.6, 2, 26, 3), scale: 'bone' },
  ],
};
