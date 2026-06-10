import type { CombatFeature } from '../types';

// LDB 10 : « gagnez un bonus de DR égal à vos niveaux de Grand orateur à n'importe quel Test de Charme quand vous parlez en public » (appliqué aux Tests étiquetés Charme (Foule)).
export const feature: CombatFeature = { key: 'Grand orateur', kind: 'talent', testDR: { match: 'charme (foule)' } };
