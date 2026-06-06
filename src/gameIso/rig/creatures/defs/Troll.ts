import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Troll",
  plan: 'biped',
  matchPriority: 40,
  match: "\\btroll",
  biped: {"career":"Nu","monster":{"tete":"troll","verrues":true}},
};
