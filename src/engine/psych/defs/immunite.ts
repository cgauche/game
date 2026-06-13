import type { PsychTraitDef } from '../types';

/** Immunité (Psychologie) (LDB 85) : la créature ignore tous les Tests de Psychologie. */
export const psych: PsychTraitDef = {
  key: 'Immunité (Psychologie)',
  apply(t, out) {
    if (!/Immunit[ée].*Psychologie/i.test(t)) return false;
    out.psychImmune = true;
    return true;
  },
};
