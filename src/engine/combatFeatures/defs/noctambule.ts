import type { CombatFeature } from '../types';

// LDB 10 : « Vous pouvez inverser le résultat de n'importe quel Test de Résistance à l'alcool raté si cela entraîne un succès. »
export const feature: CombatFeature = { key: 'Noctambule', kind: 'talent', reverseFailed: { match: 'résistance (alcool)' } };
