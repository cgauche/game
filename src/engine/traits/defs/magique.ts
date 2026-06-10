import type { TraitDef } from '../types';

// LDB 85 p.340 : « Toutes ses Attaques sont des Attaques magiques et peuvent blesser les
// créatures qui sont uniquement vulnérables aux Attaques magiques. »
export const trait: TraitDef = { key: 'Magique', magicalAttacks: true };
