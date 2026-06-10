import type { CombatFeature } from '../types';

// LDB 10 : « Si vous ratez un Test de Guérison quand vous utilisez des Bandages, vous pouvez inverser le résultat […] pas plus de +1 DR. »
export const feature: CombatFeature = { key: 'Pansement de fortune', kind: 'talent', reverseFailed: { match: 'guérison', capDR: 1 } };
