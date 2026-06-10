import type { CombatFeature } from '../types';

// LDB 10 : « Lorsque vous effectuez une Charge berserk, vous infligez +1 point de Dégât par niveau. »
export const feature: CombatFeature = { key: 'Charge berserk', kind: 'talent', chargeDamageBonus: true };
