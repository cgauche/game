import type { TraitDef } from '../types';

// LDB 85 p.340 : « Les pénalités de Blessures Critiques qui ne découlent pas d'amputations sont
// ignorées, bien que les États soient subis normalement. »
export const trait: TraitDef = { key: 'Insensible à la douleur', painless: true };
