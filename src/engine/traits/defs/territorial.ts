import type { TraitDef } from '../types';

// LDB 85 p.343 : protège une zone ; combat jusqu'à la mort ; ne poursuit pas. Annule la fuite de Bestial.
export const trait: TraitDef = { key: 'Territorial', territorial: true, note: 'Combat jusqu’à la mort pour protéger sa zone ; ne poursuit pas les fuyards (MJ).' };
