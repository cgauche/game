import type { TraitDef } from '../types';

// LDB 85 : « Armure (Indice) » donne des Points d'Armure plats sur toutes les localisations (profils
// d'éditeur, LDB 77). La valeur vit dans l'Indice/argument du registre, lue par `armourFromTraits`
// (plus de regex `/^Armure\s*\(?\+?(\d+)\)?/`). Marqueur du registre pour que `parseTrait` résolve.
export const trait: TraitDef = {
  key: 'Armure',
  note: 'Points d’Armure plats sur toutes les localisations (Indice).',
};
