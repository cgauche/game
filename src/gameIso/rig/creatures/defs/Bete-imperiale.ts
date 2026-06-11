import type { CreatureDef } from '../types';
import { OV_CORNES_VESTIGIALES, OV_GRIFFES } from '../../parts/monstrous';

// La Bête Impériale (Compagnon T1 ch.12, cage 4) : « de la taille d'un halfling, multitude
// de caractéristiques animales — mais la plus remarquable est sa FOURRURE D'OR PUR ! »
// (immunisée acide/électricité/feu ; la peau vaut 2d100 CO mais souille de Corruption).
// Trait Taille (Petite) → ×0.78 au spawn. Stats = campagne → CustomStatblock.
export const creature: CreatureDef = {
  name: 'Bête Impériale',
  plan: 'biped',
  matchPriority: 22,
  match: 'b[eê]te imp[ée]riale',
  race: 'Homme-bête',
  perso: {
    gabarit: 'gremlin',
    scale: 0.85,
    colors: { peau: '#d8b430', cheveux: '#a8821a' }, // fourrure d'or pur
    features: [
      { bone: 'tete', svg: OV_CORNES_VESTIGIALES, layer: -2 },
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
    ],
  },
};
