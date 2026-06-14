import type { CreatureDef } from '../types';

// Coureur d'égout (et coureur nocturne) : assassin furtif skaven — bandes de tissu sombres
// + capuche (tenue « Coureur d'égout »), fourrure brun-noir.
export const creature: CreatureDef = {
  name: "Coureur d'égout",
  plan: 'biped',
  matchPriority: 12,
  aliases: ['coureur degout', 'coureur d egout', 'coureur d-egout', 'coureur nocturne'],
  race: 'Skaven',
  perso: {
    tenue: "Coureur d'égout",
    colors: { peau: '#46403a', cheveux: '#1c1813' }, // fourrure brun-noir
  },
};
