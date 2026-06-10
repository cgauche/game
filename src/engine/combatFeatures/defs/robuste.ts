import type { CombatFeature } from '../types';

// LDB 10 : « Vous réduisez tous les Dégâts subis de 1 par nombre de fois […] minimum de 1 Blessure. »
export const feature: CombatFeature = { key: 'Robuste', kind: 'talent', damageReduction: true };
