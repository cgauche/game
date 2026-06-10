import type { CombatFeature } from '../types';

// LDB 10 : « Votre Attribut de Mouvement compte comme s'il était augmenté de 1 quand vous fuyez. »
export const feature: CombatFeature = { key: 'Fuite !', kind: 'talent', fleeBonus: true };
