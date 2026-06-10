import type { CombatFeature } from '../types';

// LDB 10 : « Votre Attribut de Mouvement compte comme plus élevé de 1 lorsque vous Courez. »
export const feature: CombatFeature = { key: 'Sprinter', kind: 'talent', runBonus: true };
