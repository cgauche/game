import type { TraitDef } from '../types';

// LDB 85 p.340 : « Tous les adversaires subissent une pénalité de -10 pour la toucher en combat
// au Corps à corps. »
export const trait: TraitDef = { key: 'Parasité', meleeHitPenalty: -10 };
