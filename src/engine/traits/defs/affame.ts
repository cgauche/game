import type { TraitDef } from '../types';

// LDB 85 p.338 : tue/neutralise un adversaire → Test de FM Accessible (+20) ou festoie (perd Action
// + Mouvement). Effet migré en donnée éditable (`traits.json` → effects onKill, test FM → loseTurn) ;
// def réduite à la clé canonique.
export const trait: TraitDef = { key: 'Affamé' };
