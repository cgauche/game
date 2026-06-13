import type { PsychTraitDef } from '../types';

/** Terreur N (LDB 85 l.144) : la créature cause la Terreur d'Indice N. */
export const psych: PsychTraitDef = {
  key: 'Terreur',
  apply(t, out) {
    const m = t.match(/^Terreur\s+(\d+)/i);
    if (!m) return false;
    out.causesTerreur = Number(m[1]);
    return true;
  },
};
