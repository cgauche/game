import type { CreatureDef } from '../types';

// Coureur d'égout (et coureur nocturne) : assassin furtif skaven — bandes de tissu sombres
// + capuche (tenue « Coureur d'égout »), fourrure brun-noir.
export const creature: CreatureDef = {
  label: "Coureur d'égout",
  plan: 'biped',
  race: 'Skaven',
  perso: {
    tenue: 'coureur-d-egout',
    colors: { peau: '#46403a', cheveux: '#1c1813' }, // fourrure brun-noir
  },
};
