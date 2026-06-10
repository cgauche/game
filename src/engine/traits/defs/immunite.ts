import type { TraitDef } from '../types';

// LDB 85 p.339 : « totalement immunisée à un certain Type de Dégâts […] Tous les Dégâts de ce
// Type, y compris les Dégâts Critiques, sont ignorés. » (Type entre parenthèses.)
export const trait: TraitDef = { key: 'Immunité', damageImmunity: true };
