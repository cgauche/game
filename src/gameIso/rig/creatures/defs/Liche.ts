import type { CreatureDef } from '../types';

// Liche : nécromancien mort-vivant = humanoïde SQUELETTIQUE → bipède (réutilise la tenue
// ossuaire + crâne du squelette). Recatégorisée depuis « monolithique » (jalon 3).
export const creature: CreatureDef = {
  name: 'Liche',
  plan: 'biped',
  matchPriority: 19, // après Skaven, avant Squelette (le mot « liche » est unique de toute façon)
  match: 'liche',
  biped: { career: 'Squelette', monster: { tete: 'crane' } },
};
