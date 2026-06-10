import type { CombatFeature } from '../types';

// LDB 10 : « Si vous gagnez le Test opposé de Corps à corps, au lieu de gagner +1 Avantage, vous prenez tous les Avantages actuels de votre adversaire. »
export const feature: CombatFeature = { key: 'Renversement', kind: 'talent', stealAdvantage: true };
