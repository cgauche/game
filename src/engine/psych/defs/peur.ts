import type { PsychTraitDef } from '../types';

/** Peur N (LDB 85 l.143) : la créature cause la Peur d'Indice N. */
export const psych: PsychTraitDef = {
  key: 'Peur',
  apply(t, out) {
    const m = t.match(/^Peur\s+(\d+)/i);
    if (!m) return false;
    out.causesPeur = Number(m[1]);
    return true;
  },
};
