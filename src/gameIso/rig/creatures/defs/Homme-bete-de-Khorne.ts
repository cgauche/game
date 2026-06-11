import type { CreatureDef } from '../types';
import { OV_CORNES_GOR, OV_GRIFFES } from '../../parts/monstrous';

// Hommes-bêtes de Khorne (Compagnon T1 ch.12, cage 3) : fourrure ROUGE FONCÉ, « cornes
// extrêmement aiguisées, longs crocs, mains et pieds griffus », marque du dieu du sang —
// rune-crâne JAUNE sur la poitrine. Effrayés par le feu (statbloc campagne → CustomStatblock).
const OV_RUNE_KHORNE =
  `<g stroke="#d8b428" stroke-width="0.9" fill="none" stroke-linecap="round">`
  + `<path d="M-2.6 -12 Q0 -13.6 2.6 -12 L2.4 -8.6 Q0 -7 -2.4 -8.6 Z"/>`
  + `<path d="M-1.2 -10.6 l0 1.2 M1.2 -10.6 l0 1.2 M-0.9 -7.6 l0 1.6 M0.9 -7.6 l0 1.6"/>`
  + `<path d="M-3.4 -13 L-4.6 -14.6 M3.4 -13 L4.6 -14.6"/>`
  + `</g>`;

export const creature: CreatureDef = {
  name: 'Homme-bête de Khorne',
  plan: 'biped',
  matchPriority: 21, // avant Homme-bête (30) ; « de khorne » requis → ne vole pas le Sanguinaire
  match: 'homme.?b[eê]te de khorne|b[eê]te de khorne',
  race: 'Homme-bête',
  perso: {
    colors: { peau: '#6e2a20', cheveux: '#38140e' }, // fourrure rouge sombre
    features: [
      { bone: 'tete', svg: OV_CORNES_GOR, layer: -2 },
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
      { bone: 'torse', svg: OV_RUNE_KHORNE, scale: 'bone', layer: 62, view: 'front' },
    ],
  },
};
