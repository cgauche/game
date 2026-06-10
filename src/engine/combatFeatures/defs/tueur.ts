import type { CombatFeature } from '../types';

// LDB 10 : « utilisez le Bonus d'Endurance de votre adversaire comme votre Bonus de Force s'il est plus élevé ».
export const feature: CombatFeature = { key: 'Tueur', kind: 'talent', slayer: true };
