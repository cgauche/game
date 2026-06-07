import type { CreatureDef } from '../types';

// Araignée géante (gabarit arachnide) — abdomen + 8 pattes, yeux rougeoyants. 1 fichier, rempli.
export const creature: CreatureDef = {
  name: 'Araignée',
  plan: 'arachnid',
  aliases: ['araignee', 'arachnide', 'tisseuse', 'veuve'],
  spider: {
    sl: 1.0, girth: 1.0,
    stored: { corps: '#2e2622', corpsO: '#181210', corpsH: '#574438', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
  },
};
