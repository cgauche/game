import type { CreatureDef } from '../types';

// Pieuvre des tourbières (gabarit céphalopode) — manteau + 8 tentacules, pupilles horizontales. 1 fichier.
export const creature: CreatureDef = {
  name: 'Pieuvre',
  plan: 'cephalopod',
  aliases: ['pieuvre', 'poulpe', 'octopus', 'calmar', 'calamar', 'kraken'],
  octopus: {
    sl: 1.05, girth: 1.0,
    stored: { corps: '#7a4a5e', corpsO: '#4e2c3c', corpsH: '#a86e80', cheveux: '#3a2230', cheveuxO: '#241218', cuir: '#d8c64a' },
  },
};
