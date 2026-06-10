import type { CombatFeature } from '../types';

// LDB 10 : « +1 Dégât supplémentaire pour chaque niveau […] pour tous les coups réussis avec Corps à corps (Bagarre). »
export const feature: CombatFeature = { key: 'Combat déloyal', kind: 'talent', brawlDamageBonus: true };
