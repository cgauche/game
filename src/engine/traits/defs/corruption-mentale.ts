import type { TraitDef } from '../types';

// LDB 85 p.339 : « Le Chaos s'est insinué dans l'esprit de la créature… Faites un lancer sur le
// Tableau de la Corruption Mentale (p.185). » Tirée au spawn (graine stable) — spawn.ts.
export const trait: TraitDef = { key: 'Corruption mentale', mutationAtSpawn: 'mentale' };
