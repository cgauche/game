import type { CombatFeature } from '../types';

// LDB 10 : « Vous ajoutez un DR égal à votre niveau […] à n'importe quel Test pour recharger une arme à distance. »
export const feature: CombatFeature = { key: 'Rechargement rapide', kind: 'talent', reloadDR: 'all' };
