import type { CreatureDef } from '../types';
import { OV_CORNES_CAPRIN } from '../../parts/monstrous';

// Prophète gris : sorcier-prêtre skaven — fourrure GRISE (le tell canon), CORNES caprines
// (signe du Rat Cornu) en feature ADDITIVE (garde tête de rat + queue rose de la race)
// + robe rituelle (tenue dédiée « Prophète gris »).
export const creature: CreatureDef = {
  name: 'Prophète gris',
  plan: 'biped',
  matchPriority: 12, // avant le def Skaven générique
  aliases: ['prophete-gris', 'prophetegris'], // « prophete gris » = le nom
  race: 'Skaven',
  perso: {
    career: 'Prophète gris',
    features: [{ bone: 'tete', svg: OV_CORNES_CAPRIN, layer: -2 }], // cornes derrière le crâne
    colors: { peau: '#b3aca0', cheveux: '#8a8478' }, // fourrure grise
  },
};
