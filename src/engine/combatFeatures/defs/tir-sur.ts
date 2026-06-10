import type { CombatFeature } from '../types';

// LDB 10 : « Quand vous la touchez, vous pouvez ignorer un nombre de PA égal à votre Niveau de Tir sûr. »
export const feature: CombatFeature = { key: 'Tir sûr', kind: 'talent', rangedAPIgnore: true };
