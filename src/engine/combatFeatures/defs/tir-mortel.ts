import type { CombatFeature } from '../types';

// LDB 10 : « Au lieu d'inverser le dé pour déterminer quelle Localisation est touchée avec votre arme à distance, vous pouvez la choisir. »
export const feature: CombatFeature = { key: 'Tir mortel', kind: 'talent', ignoreCalledShotRanged: true };
