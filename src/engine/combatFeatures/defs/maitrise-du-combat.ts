import type { CombatFeature } from '../types';

// LDB 10 : « vous comptez comme une personne supplémentaire lors du calcul pour déterminer si vous êtes en surnombre » (par niveau).
export const feature: CombatFeature = { key: 'Maîtrise du combat', kind: 'talent', outnumberCount: true };
