import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Orc",
  plan: 'biped',
  matchPriority: 36,
  match: "\\borc\\b|\\borque\\b|peau.?verte",
};
