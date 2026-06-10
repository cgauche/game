import type { CombatFeature } from '../types';

// LDB 10 : « Vous infligez votre niveau de Coup puissant en Dégâts supplémentaires avec des armes de Corps à corps. »
export const feature: CombatFeature = { key: 'Coup puissant', kind: 'talent', meleeDamageBonus: true };
