import type { CombatFeature } from '../types';

// LDB 10 : « Vous pouvez inverser n'importe quel Test de Ragot si cela permet au Test de réussir. »
export const feature: CombatFeature = { key: 'Sociable', kind: 'talent', reverseFailed: { match: 'ragot' } };
