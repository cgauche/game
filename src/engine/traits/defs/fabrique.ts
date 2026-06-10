import type { TraitDef } from '../types';

// LDB 85 p.339 : pas d'Int/FM/Soc (Tests automatiquement réussis) ; toutes ses Attaques sont Magiques.
export const trait: TraitDef = { key: 'Fabriqué', mindless: true, magicalAttacks: true, note: 'Pas d’Int/FM/Soc (Tests auto-réussis) ; Blessures calculées avec le Bonus de Force au lieu du BFM ; erre sans contrôle (MJ).' };
