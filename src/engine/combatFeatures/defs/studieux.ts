import type { CombatFeature } from '../types';

// LDB 10 : « Quand vous utilisez Recherche, vous pouvez inverser le résultat de n'importe quel Test raté si cela entraîne un succès. »
export const feature: CombatFeature = { key: 'Studieux', kind: 'talent', reverseFailed: { match: 'recherche' } };
