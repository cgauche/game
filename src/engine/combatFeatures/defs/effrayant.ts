import type { CombatFeature } from '../types';

// LDB 10 : « vous avez un Indice de Peur de 1 […] +1 à cet Indice par nombre de fois supplémentaires. »
export const feature: CombatFeature = { key: 'Effrayant', kind: 'talent', causesFear: true };
