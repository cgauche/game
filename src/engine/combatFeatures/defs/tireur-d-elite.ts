import type { CombatFeature } from '../types';

// LDB 10 : « Vous ignorez les modificateurs de Difficulté des Tests de Projectiles dus à la taille de votre cible. »
export const feature: CombatFeature = { key: "Tireur d'élite", kind: 'talent', ignoreSizeRangedMods: true };
