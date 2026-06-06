import type { CreatureDef } from '../types';

export const creature: CreatureDef = {
  name: "Orc",
  plan: 'biped',
  matchPriority: 36,
  match: "\\borc\\b|\\borque\\b|peau.?verte",
  biped: {"career":"Mendiant","monster":{"tete":"orc"},"colors":{"vet1":"#5a4a30","vet2":"#3a2a1c","cuir":"#5a3f24"}},
};
