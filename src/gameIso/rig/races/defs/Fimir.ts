// Fimir : proportions d'ogre (carrure brute) mais sans les traits cosmétiques Ogre
// (heaume/pauldrons/gut-plate propres à l'Ogre). Tête cyclope + queue + cuir écailleux
// portés ICI (race dédiée mono-consommateur) — un perso.monster court-circuiterait les features.
import type { RaceDef } from '../types';
import { OV_QUEUE } from '../../parts/monstrous';
import { scalesPatch } from '../../parts/textures';
export const race: RaceDef = {
  id: 'Fimir',
  gabarit: 'brute',
  palette: { peau: "#6b7a52", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" }, // chair gris-vert de vase (ombres dérivées)
  career: 'Nu',
  head: 'cyclope',
  // Queue traînante derrière le bassin ; cuir ÉCAILLEUX (textures.ts) : le démon des marais
  // est reptilien — écailles imbriquées sur torse, épaules et cuisses (tokens @peau).
  features: [
    { bone: 'bassin',  svg: OV_QUEUE, scale: 'bone', layer: -2 },
    { bone: 'torse',   svg: scalesPatch(-8, 8, -20, 12, 3), scale: 'bone' },
    { bone: 'epauleG', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
    { bone: 'epauleD', svg: scalesPatch(-2.6, 2.6, 2, 26, 2.6), scale: 'bone' },
    { bone: 'cuisseG', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
    { bone: 'cuisseD', svg: scalesPatch(-3, 3, 2, 42, 3), scale: 'bone' },
  ],
};
