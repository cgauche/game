import type { CombatFeature } from '../types';

// LDB 10 : « Quand vous utilisez la Compétence Intimidation, gagnez un bonus de DR égal à vos Niveaux de Menaçant. »
export const feature: CombatFeature = { key: 'Menaçant', kind: 'talent', testDR: { match: 'intimidation' } };
