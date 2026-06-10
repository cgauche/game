import type { CombatFeature } from '../types';

// LDB 10 : « Vous infligez votre niveau de Frappe blessante en Blessures supplémentaires quand vous causez une Blessure Critique. »
export const feature: CombatFeature = { key: 'Frappe blessante', kind: 'talent', critExtraWounds: true };
