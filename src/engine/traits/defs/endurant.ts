import type { TraitDef } from '../types';

// LDB 85 p.339 : « Augmentez ses Points de Blessure d'un nombre égal à son Bonus d'Endurance
// (appliqué avant tout modificateur de Taille). »
export const trait: TraitDef = { key: 'Endurant', bonusWoundsBE: true };
