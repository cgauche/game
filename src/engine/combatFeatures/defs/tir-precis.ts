import type { CombatFeature } from '../types';

// LDB 10 : « Votre niveau de Tir précis équivaut à des dégâts supplémentaires pour toutes les armes à distance. »
export const feature: CombatFeature = { key: 'Tir précis', kind: 'talent', rangedDamageBonus: true };
