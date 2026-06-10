import type { CombatFeature } from '../types';

// LDB 10 : « Vous pouvez inverser un Test de Recherche raté si cela permet de le réussir. »
export const feature: CombatFeature = { key: 'Lecture rapide', kind: 'talent', reverseFailed: { match: 'recherche' } };
