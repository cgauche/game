import type { CombatFeature } from '../types';

// LDB 10 : Talent de lanceur d'Arcane — ouvre l'apprentissage des Sorts du Domaine (spec) + Arcanes
// communs. Famille d'incantation 'arcane' (grimoire.ts) ; le Domaine est porté par ctx.spec.
export const feature: CombatFeature = { key: 'Magie des Arcanes', kind: 'talent', castingKind: 'arcane' };
