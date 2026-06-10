import type { TraitDef } from '../types';

// LDB 85 p.341 : « Elle reçoit +1 M et +10 en Ag. »
export const trait: TraitDef = { key: 'Rapide', charMods: { Ag: 10 }, movement: 1 };
