import type { CombatFeature } from '../types';

// LDB 10 : ajoute le mode d'attaque « des deux armes » (frappe off-hand conditionnelle, d100 inversé).
export const feature: CombatFeature = { key: 'Maniement de deux armes', kind: 'talent', attackModes: () => ['dual-wield'] };
