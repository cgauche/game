import { targetedTraitDef } from '../types';

/** Animosité (Cible) (LDB 21). */
export const psych = targetedTraitDef('Animosité', /^Animosit[ée]\s*\(([^)]*)\)/i, 'animosite');
