import type { CombatFeature } from '../types';

// LDB 10 : « Test de Perception Intermédiaire (+0) pour ignorer la Surprise. »
export const feature: CombatFeature = { key: 'Vigilance', kind: 'talent', surpriseSave: true };
