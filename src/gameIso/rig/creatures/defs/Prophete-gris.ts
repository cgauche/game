import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Prophète gris : sorcier-prêtre skaven — fourrure GRISE (le tell canon), CORNES caprines
// (signe du Rat Cornu) en feature ADDITIVE (garde tête de rat + queue rose de la race)
// + robe rituelle (tenue dédiée « Prophète gris »).
export const creature: CreatureDef = {
  label: 'Prophète gris',
  id: "prophete-gris",
  plan: 'biped',
  race: 'skaven',
  perso: {
    tenue: 'prophete-gris',
    features: [appendageFeature('cornes-caprin')], // cornes derrière le crâne
    colors: { peau: '#b3aca0', cheveux: '#8a8478' }, // fourrure grise
  },
};
