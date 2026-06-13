import { targetedTraitDef } from '../types';

/** Effrayé (Cible) (LDB 85 p.339) : « Peur 0 de la Cible » → ciblé phobie, Indice 0. */
export const psych = targetedTraitDef('Effrayé', /^Effray[ée]\s*\(([^)]*)\)/i, 'phobie', 0);
