import type { CreatureDef } from '../types';

// Sangsue géante (gabarit serpentin, variante SANS capuchon, brun-rouge, plus épaisse). 1 fichier.
export const creature: CreatureDef = {
  name: 'Sangsue',
  plan: 'serpentine',
  aliases: ['sangsue', 'ver geant', 'asticot'],
  serpent: {
    sl: 0.92, girth: 1.18, hood: false,
    stored: { corps: '#6a3a3a', corpsO: '#421f1f', corpsH: '#8a5050', cheveux: '#2a1414', cheveuxO: '#160a0a', cuir: '#7a5a2a' },
  },
};
