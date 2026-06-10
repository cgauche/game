import type { TraitDef } from '../types';

// LDB 85 p.340 : « La créature a la "chance" de posséder une Mutation. Faites un lancer sur le
// Tableau des Corruptions physiques (page 184). » Tirée au spawn (graine stable) — spawn.ts.
export const trait: TraitDef = { key: 'Mutation', mutationAtSpawn: 'physique' };
