import type { CombatFeature } from '../types';

// LDB 10 : « Vous ignorez la pénalité due à la désignation d'une Localisation pour frapper à la Tête […] arme de Corps à corps avec l'Atout Assommante. »
export const feature: CombatFeature = { key: 'Frappe assommante', kind: 'talent', ignoreCalledShotHead: true };
