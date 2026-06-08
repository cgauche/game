import type { CreatureDef } from '../types';

// Fimir : brute marécageuse à ŒIL UNIQUE et queue → bipède (proportions d'ogre via
// baseSpeciesOf, tête cyclope dédiée + queue, peau gris-vert). Recatégorisé depuis monolithique
// (jalon 3 : la pièce manquante = la tête cyclope, ajoutée à monstrous.ts).
export const creature: CreatureDef = {
  name: 'Fimir',
  plan: 'biped',
  matchPriority: 44,
  match: '\\bfimir',
  // Espèce NON-canonique : baseSpeciesOf('Fimir')→'Ogre' (proportions d'ogre). Sa config distincte
  // (œil unique + queue + chair gris-vert) vit sur le perso, pour ne pas polluer la race Ogre.
  perso: {
    career: 'Nu',
    monster: { tete: 'cyclope', queue: true },
    colors: { peau: '#6b7a52' }, // chair gris-vert (ombres/reflets dérivés auto)
  },
};
