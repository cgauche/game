import type { CombatFeature } from '../types';

// LDB 10 / EDO : Talent de sorcellerie du Chaos — chaque Sort appris reprend le Talent (100 PX +
// 1 Point de Corruption). Famille d'incantation 'chaos' (grimoire.ts) ; le subType est porté par ctx.spec.
export const feature: CombatFeature = { key: 'Magie du Chaos', kind: 'talent', castingKind: 'chaos' };
