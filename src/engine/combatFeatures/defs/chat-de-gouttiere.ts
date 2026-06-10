import type { CombatFeature } from '../types';

// LDB 10 : « Quand vous utilisez Discrétion (Urbaine), vous pouvez inverser le lancer de n'importe quel Test raté si cela entraîne un Succès. »
export const feature: CombatFeature = { key: 'Chat de gouttière', kind: 'talent', reverseFailed: { match: 'discrétion (urbaine)' } };
