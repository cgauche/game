import type { CombatFeature } from '../types';

// LDB 10 : « Quand vous utilisez un Bouclier pour vous défendre, vous gagnez un nombre d'Avantages égal au nombre de Niveaux. »
export const feature: CombatFeature = { key: 'Porte-Bouclier', kind: 'talent', shieldAdvantage: true };
