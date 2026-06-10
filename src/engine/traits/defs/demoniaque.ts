import type { TraitDef } from '../types';

// LDB 85 p.339 : toutes ses attaques sont Magiques ; 1d10 après chaque coup reçu ≥ Indice → coup
// ignoré (même critique) ; à 0 PB, l'âme retourne aux Royaumes du Chaos (retirée du jeu).
export const trait: TraitDef = { key: 'Démoniaque', wardSave: true, magicalAttacks: true, banishedAtZero: true };
