import type { TraitDef } from '../types';

// LDB 85 p.338 : « Elle reçoit -1 en M, -10 en Ag et +10 en F et en E. »
export const trait: TraitDef = { key: 'Brutal', charMods: { Ag: -10, F: 10, E: 10 }, movement: -1 };
