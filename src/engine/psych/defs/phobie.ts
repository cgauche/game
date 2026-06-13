import { targetedTraitDef } from '../types';

/** Phobie (Cible) (LDB 21 l.84-87) : équivaut à Peur 1 de la Cible. */
export const psych = targetedTraitDef('Phobie', /^Phobie\s*\(([^)]*)\)/i, 'phobie', 1);
