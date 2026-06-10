import type { CombatFeature } from '../types';

// LDB 10 : « Ajoutez votre niveau de Bonnes jambes à votre DR à tous les Tests d'Athlétisme impliquant Saut. »
export const feature: CombatFeature = { key: 'Bonnes jambes', kind: 'talent', testDR: { match: 'athlétisme (saut)' } };
