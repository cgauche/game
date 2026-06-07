import type { CreatureDef } from '../types';

// « Bête des marais » — créature générique sans forme arrêtée : reste monolithique (sprite legacy
// par nom). Def de ROUTAGE (remplace EXOTIC_RE).
export const creature: CreatureDef = {
  name: 'Bête des marais',
  plan: 'monolithic',
  aliases: ['bete des marais'],
};
