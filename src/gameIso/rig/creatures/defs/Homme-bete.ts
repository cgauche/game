import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Homme-bête",
  plan: 'biped',
  matchPriority: 30,
  match: "\\bgor\\b|ungor|bestigor|homme.?bete|beastman|brey|chamane.?brey",
  biped: {"career":"Nu","monster":{"tete":"caprin","cornes":true,"jambes":"chevre","queue":true}},
};
