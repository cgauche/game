import type { CreatureDef } from '../types';

// Varghulf — « grandes bêtes aux allures de chauve-souris » (LDB 82 l.21-24), artwork
// art-ref/ldb/page329_img8024.png. Trois signatures de la figure : 1) l'immense ÉVENTAIL
// d'excroissances osseuses en forme d'ailes repliées qui domine le dos — membrane rousse
// dressée à demi-ouverte (wingPose 'dressees', wingSpan ample) TRAVERSÉE de longues lames
// d'os couleur corne (deco aileD/aileG) ; 2) palette TERREUSE — fourrure brun charbon,
// reflets fauves, membrane orange feu, serres et os couleur corne ; 3) posture TAPIE
// agressive — échine arquée (build 'rodent'), membres courts fléchis, encolure plongeante
// tête basse prête à bondir. Tête 'rat' (museau camus à truffe charnue, œil sombre),
// oreilles pointues, gueule à crocs, moignon de queue, fourrure hérissée + épines dorsales.

// Éventail d'os du dos : lames longues et fines rayonnant de l'épaule au-delà de la membrane
// (repère local du garrot, mêmes coordonnées que l'art 'dressees' → même ×wingSpan que lui).
const EVENTAIL_OS =
  `<g data-deco="eventail" transform="scale(1.9)">` +
  `<path d="M-1.6 -1 L-8.6 -52 L-5.2 -51.4 L0.6 -1.6 Z M-4.4 -0.4 L-16.4 -47 L-13.2 -46.4 L-2 -0.2 Z ` +
  `M-7.2 0.4 L-24.6 -38.5 L-21.8 -39.2 L-4.6 0.9 Z M-9.6 1.2 L-30.6 -26.5 L-28.2 -28.3 L-7.4 1.8 Z ` +
  `M-11.6 2 L-33.4 -14.5 L-31.9 -16.8 L-9.8 2.6 Z" fill="@cuir" stroke="#241708" stroke-width="0.45"/>` +
  // nodosités d'articulation le long des lames (lecture « os », pas « piquant »)
  `<path d="M-4.6 -27 q1.6 0.9 3 0.5 M-6.6 -39 q1.5 0.9 2.8 0.5 M-9.8 -24 q1.5 1 2.9 0.7 ` +
  `M-13.4 -35 q1.4 0.9 2.7 0.6 M-15.4 -20 q1.4 1.1 2.8 0.9 M-20 -14 q1.3 1.1 2.7 1" ` +
  `fill="none" stroke="@cuirO" stroke-width="0.55" opacity="0.75"/>` +
  `</g>`;

export const creature: CreatureDef = {
  name: 'Varghulf',
  plan: 'winged',
  quad: {
    sl: 1.12, build: 'rodent', girth: 1.35, bodyLen: 1.02, neckLen: 0.55, neckAngle: 34, legLen: 0.6,
    head: 'rat', headScale: 1.35, tail: 'courte', tailLen: 0.8, ears: 'pointues',
    foot: 'serre', wings: 'membrane', wingSpan: 1.9, wingPose: 'dressees',
    mane: 'hirsute', ridge: 'epines', markings: 'sans',
    deco: { aileD: EVENTAIL_OS, aileG: EVENTAIL_OS },
    stored: {
      corps: '#54402e', corpsO: '#271a10', corpsH: '#a37a4c', // fourrure brun charbon, reflets fauves
      cheveux: '#2a1c11', cheveuxO: '#140d06', // hérissement sombre de l'échine
      aile: '#b05e24', aileO: '#571f08', aileH: '#e08c3f', // membrane orange feu (signature artwork)
      cuir: '#c9a06a', // serres et lames d'os couleur corne
    },
  },
};
