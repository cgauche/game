import type { CombatFeature } from '../types';

// LDB 10 : Talent de prêtre — ouvre l'apprentissage des Miracles du culte (spec). Famille
// d'incantation 'invocation' (grimoire.ts) ; le Culte est porté par ctx.spec.
export const feature: CombatFeature = { key: 'Invocation', kind: 'talent', castingKind: 'invocation' };
