import type { TraitDef } from '../types';

// LDB 85 p.341 : début de Round, PB>0 → régénère 1d10 ; à 0 → 1d10, 8+ → 1 PB ; un 10 soigne aussi
// un Critique. Effet migré en donnée éditable (`traits.json` → effects onRoundStart : if(état de soi)
// → rollThreshold avec {rolled}) ; def réduite à la clé canonique. (Exception du Feu : non tracée.)
export const trait: TraitDef = { key: 'Régénération' };
