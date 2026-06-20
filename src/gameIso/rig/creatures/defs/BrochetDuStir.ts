import type { CreatureDef } from '../types';

// Brochet du Stir (ZI p.36-38) — brochet géant (vrai poisson fusiforme, ~3,5 m, Taille Grande),
// « Queue mortelle » (grande caudale) + Morsure (longue gueule dentée). Gabarit poisson. Dos
// gris-verdâtre moucheté, ventre clair. Réf art : art-ref/zi/page039_full.png.
export const creature: CreatureDef = {
  name: 'Brochet du Stir',
  plan: 'fish',
  fish: {
    sl: 1.05, girth: 1.0,
    stored: { corps: '#5a6850', corpsO: '#32402a', corpsH: '#b6c2a6', cheveux: '#32402a', cheveuxO: '#1e2818', cuir: '#7c8868' },
  },
};
