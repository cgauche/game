import type { CombatFeature } from '../types';

// LDB 10 : « Ajoutez votre niveau de Talent Déterminé à votre Bonus de Force quand vous Chargez. »
export const feature: CombatFeature = { key: 'Déterminé', kind: 'talent', chargeDamageBonus: true };
