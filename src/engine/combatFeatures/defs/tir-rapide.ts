import type { CombatFeature } from '../types';

// LDB 10 : « Si vous avez une arme à distance chargée, vous pouvez faire feu en dehors de l'ordre d'Initiative normal. »
export const feature: CombatFeature = { key: 'Tir rapide', kind: 'talent', strikeFirstRanged: true };
