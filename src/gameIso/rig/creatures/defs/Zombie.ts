import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Zombie",
  plan: 'biped',
  matchPriority: 24,
  aliases: ["zombie"],
  biped: {"career":"Mendiant","monster":{"tete":"pourri","plaie":true}},
};
