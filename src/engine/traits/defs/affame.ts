import type { TraitDef } from '../types';

// LDB 85 p.338 : tue/neutralise un adversaire → Test de FM Accessible (+20) ou festoie,
// perdant sa prochaine Action et son prochain Mouvement.
export const trait: TraitDef = { key: 'Affamé', gorgesOnKill: true };
