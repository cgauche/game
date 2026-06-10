import type { TraitDef } from '../types';

// LDB 85 p.338 : « Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité Psychologique. »
export const trait: TraitDef = { key: 'Belliqueux', psychImmuneIfAhead: true };
