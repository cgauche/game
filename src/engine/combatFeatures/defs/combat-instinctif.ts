import type { CombatFeature } from '../types';

// LDB 10 : « Votre Initiative est plus élevée de 10 pour déterminer l'Initiative de Combat pour chaque niveau. »
export const feature: CombatFeature = { key: 'Combat instinctif', kind: 'talent', initiativeBonus: true };
