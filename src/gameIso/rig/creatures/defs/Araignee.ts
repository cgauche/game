import type { CreatureDef } from '../types';

// Araignée géante (gabarit arachnide) — abdomen + 8 pattes, yeux rougeoyants. 1 fichier, rempli.
export const creature: CreatureDef = {
  name: 'Araignée',
  plan: 'arachnid',
  aliases: ['araignee', 'arachnide', 'tisseuse', 'veuve'],
  spider: {
    sl: 1.0, girth: 1.14, // gros abdomen bulbeux (LDB 78 : « effroyablement grandes »)
    stored: { corps: '#352b22', corpsO: '#120d09', corpsH: '#c8893f', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
  },
};
