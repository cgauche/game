import type { TraitDef } from '../types';

// LDB 85 p.341 : début de Round, PB > 0 → régénère 1d10 PB ; à 0 PB → 1d10, 8+ → 1 PB ; un 10
// soigne aussi une Blessure Critique. Les Blessures infligées par le Feu ne régénèrent pas.
export const trait: TraitDef = { key: 'Régénération', regenerates: true };
