// Homme-bête : trapu musclé voûté, légèrement étiré en hauteur.
import type { RaceDef } from '../types';
import { OV_QUEUE } from '../../parts/monstrous';
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
  // PAS de cornes ici : la taille des cornes = statut de l'homme-bête (LDB 83), portée par
  // CHAQUE def créature (Gor grandes / Ungor vestigiales / Chamane caprines) en perso.features.
  // Queue de pelage derrière le bassin ; PELAGE (textures.ts) sur le poitrail nu et les épaules.
  features: [
    { bone: 'bassin', svg: OV_QUEUE,         scale: 'bone', layer: -2 },
    { bone: 'torse',   svg: furPatch(-7.5, 7.5, -19, 11, 3.2), scale: 'bone' },
    { bone: 'epauleG', svg: furPatch(-2.4, 2.4, 2, 24, 2.8),   scale: 'bone' },
    { bone: 'epauleD', svg: furPatch(-2.4, 2.4, 2, 24, 2.8),   scale: 'bone' },
  ],
};
