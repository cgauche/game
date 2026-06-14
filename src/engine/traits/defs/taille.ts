import type { TraitDef } from '../types';

// LDB 85 : « Taille (X) » donne la catégorie de Taille de la créature (l'argument entre parenthèses,
// éventuellement une plage « de Petite à Énorme » → borne haute). La catégorie est lue par
// `sizeFromTraits` via l'ARG du registre (plus de regex `/^Taille\s*\(…\)/`). Marqueur du registre
// pour que `parseTrait` résolve le trait ; la valeur vit dans l'argument, pas dans un champ statique.
export const trait: TraitDef = {
  key: 'Taille',
  note: 'Catégorie de Taille de la créature (argument entre parenthèses).',
};
