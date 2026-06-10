import type { TraitDef } from '../types';

// LDB 85 p.340 : « Elle reçoit +20 en Int et +10 en I. »
export const trait: TraitDef = { key: 'Intelligent', charMods: { Int: 20, I: 10 } };
