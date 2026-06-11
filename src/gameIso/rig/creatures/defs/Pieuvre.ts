import type { CreatureDef } from '../types';

// Pieuvre des tourbières (gabarit céphalopode) — manteau + 8 tentacules, pupilles horizontales. 1 fichier.
export const creature: CreatureDef = {
  name: 'Pieuvre',
  plan: 'cephalopod',
  aliases: ['pieuvre', 'poulpe', 'octopus', 'calmar', 'calamar', 'kraken'],
  // LDB 79 l.130-135 : « marbrées de vert et de brun » (camouflage de marécage),
  // « immenses yeux limpides », tentacules robustes, Taille (Grande).
  octopus: {
    sl: 1.05, girth: 1.1,
    stored: { corps: '#5d6b3c', corpsO: '#46351f', corpsH: '#94a35e', cheveux: '#3a3220', cheveuxO: '#241e12', cuir: '#d8c64a' },
  },
};
