import type { CreatureDef } from '../types';

// Squig (peau-verte) — forme « balle à dents » sans gabarit qui colle : reste monolithique
// (sprite legacy par nom). Le def ne sert qu'au ROUTAGE (remplace l'ancien EXOTIC_RE).
export const creature: CreatureDef = {
  name: 'Squig',
  plan: 'monolithic',
  aliases: ['squig'],
};
