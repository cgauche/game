import type { CombatFeature } from '../types';

// LDB 10 : « Vous pouvez inverser n'importe quel Test de Métier (Apothicaire) raté si cela permet d'obtenir un succès. »
export const feature: CombatFeature = { key: 'Pharmacologie', kind: 'talent', reverseFailed: { match: 'métier (apothicaire)' } };
