import type { TraitDef } from '../types';

// LDB 85 p.338 : « Quand elle Charge ou Court, elle double sa Caractéristique de Mouvement, et
// elle peut ignorer tous les terrains et les personnages qui s'interposent. »
export const trait: TraitDef = { key: 'Bond', leap: true };
