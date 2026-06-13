import { targetedTraitDef } from '../types';

/** Amour (Cible) (LDB 21). */
export const psych = targetedTraitDef('Amour', /^Amour\s*\(([^)]*)\)/i, 'amour');
