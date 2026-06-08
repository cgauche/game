import type { CreatureDef } from '../types';

// Fimir : brute marécageuse à ŒIL UNIQUE et queue → bipède (proportions d'ogre via
// baseSpeciesOf, tête cyclope dédiée + queue, peau gris-vert). Recatégorisé depuis monolithique
// (jalon 3 : la pièce manquante = la tête cyclope, ajoutée à monstrous.ts).
export const creature: CreatureDef = {
  name: 'Fimir',
  plan: 'biped',
  matchPriority: 44,
  match: '\\bfimir',
  // Race dédiée (même gabarit brute que l'Ogre, mais SANS les features cosmétiques Ogre :
  // heaume/pauldrons/gut-plate sont propres à l'Ogre et ne doivent pas contaminer le Fimir).
  race: 'Fimir',
  // Config distincte (œil unique + queue + chair gris-vert) vit ici, pas sur la race.
  perso: {
    career: 'Nu',
    monster: { tete: 'cyclope', queue: true },
    colors: { peau: '#6b7a52' }, // chair gris-vert (ombres/reflets dérivés auto)
  },
};
