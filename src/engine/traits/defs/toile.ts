import type { TraitDef } from '../types';

// LDB 85 p.343 : « Chaque fois qu'elle réussit à toucher, son adversaire gagne 1 État Empêtré,
// avec une Force de Indice. »
export const trait: TraitDef = { key: 'Toile', webOnHit: true };
