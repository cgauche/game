import type { TraitDef } from '../types';

// LDB 85 p.341 : sans allié non-Stupide à ses côtés, Test d'Intelligence Facile (+40) au début de
// chaque Round ; échec → perd Mouvement ET Action.
export const trait: TraitDef = { key: 'Stupide', stupid: true };
