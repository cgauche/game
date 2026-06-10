import type { TraitDef } from '../types';

// LDB 85 p.341 : « Lancer 1d10 après chaque coup reçu. En cas de résultat supérieur ou égal à
// Indice, le coup est ignoré même s'il s'agit d'un Critique. »
export const trait: TraitDef = { key: 'Protection', wardSave: true };
