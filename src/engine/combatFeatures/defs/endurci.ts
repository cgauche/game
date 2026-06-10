import type { CombatFeature } from '../types';

// LDB 10 : « ignorer le Point de Blessure perdu à cause d'un État Hémorragique » (un par niveau).
export const feature: CombatFeature = { key: 'Endurci', kind: 'talent', bleedIgnore: true };
