import type { CreatureDef } from '../types';

// Fimir : brute marécageuse à ŒIL UNIQUE et queue → bipède (proportions d'ogre via
// baseSpeciesOf, tête cyclope dédiée + queue, peau gris-vert). Recatégorisé depuis monolithique
// (jalon 3 : la pièce manquante = la tête cyclope, ajoutée à monstrous.ts).
export const creature: CreatureDef = {
  name: 'Fimir',
  plan: 'biped',
  matchPriority: 44,
  match: '\\bfimir',
  // Race dédiée (même gabarit brute que l'Ogre, mais SANS les features cosmétiques Ogre).
  // Tête cyclope, queue, chair gris-vert et cuir écailleux vivent SUR LA RACE (head/palette/
  // features) : un perso.monster court-circuiterait les features (écailles).
  race: 'Fimir',
};
