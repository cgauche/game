import type { CreatureDef } from '../types';
import { OV_CORNES } from '../../parts/monstrous';

// Furie du Chaos (Compagnon T1 ch.9) : « silhouette grossière d'HOMME-BÊTE AILÉ ; long museau
// canin ; cornes courtes et pointues ; yeux jaunes brûlants ; peau parsemée de fourrure sombre
// et d'écailles reptiliennes rouges ; ailes en CUIR » (trait Vol 90, Arme +8 Griffes).
// Plaques d'écailles rouges sur le poitrail et les épaules (littérales : pas la palette).
const OV_ECAILLES = (dx: number, dy: number, s: number) =>
  `<g transform="translate(${dx},${dy}) scale(${s})" fill="#8a2418" stroke="#4a1009" stroke-width="0.4">`
  + `<path d="M-3 0 q1.5 -2.4 3 0 q-1.5 2 -3 0 Z"/><path d="M0.6 -2.6 q1.5 -2.4 3 0 q-1.5 2 -3 0 Z"/>`
  + `<path d="M1.2 2.2 q1.5 -2.4 3 0 q-1.5 2 -3 0 Z"/><path d="M-2.2 -4.4 q1.4 -2.2 2.8 0 q-1.4 1.9 -2.8 0 Z"/>`
  + `</g>`;

export const creature: CreatureDef = {
  name: 'Furie du Chaos',
  plan: 'biped',
  matchPriority: 37, // avant Démon (38) — « furie » seul suffit
  aliases: ['furie'],
  perso: {
    tenue: 'Nu',
    gabarit: 'elance-voute',
    monster: { tete: 'chien', ailes: 'cuir', griffes: true, queue: true },
    colors: { peau: '#3a2c22' }, // fourrure sombre (les ailes-cuir @peauO suivent)
    features: [
      // cornes PAR VUE (les génériques toutes-vues flottaient au-dessus du museau de profil)
      { bone: 'tete', svg: OV_CORNES, layer: -2, view: 'front' },
      { bone: 'tete', svg: OV_CORNES, layer: -2, view: 'back' },
      { bone: 'tete', svg: `<path d="M1 -2 q-3 -8 -9 -11 q2.6 6.6 4.8 12.6 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`, layer: -2, view: 'profile' },
      // plaques DISPERSÉES (pas alignées : une diagonale lisait « bandoulière »)
      { bone: 'torse', svg: OV_ECAILLES(-6, -16, 0.9), scale: 'bone', layer: 60 },
      { bone: 'torse', svg: OV_ECAILLES(7, -7, 0.75), scale: 'bone', layer: 60 },
      { bone: 'torse', svg: OV_ECAILLES(-3, 6, 0.7), scale: 'bone', layer: 60 },
      { bone: 'cuisseD', svg: OV_ECAILLES(0, 14, 0.7), scale: 'bone', layer: 60 },
      { bone: 'epauleG', svg: OV_ECAILLES(0, 8, 0.65), scale: 'bone', layer: 60 },
    ],
  },
};
