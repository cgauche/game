import type { CombatFeature } from '../types';

// LDB 10 : « aucune pénalité lors d'un tir à Longue distance, et la moitié des pénalités à Portée extrême. »
export const feature: CombatFeature = { key: 'Tireur embusqué', kind: 'talent', sniper: true };
