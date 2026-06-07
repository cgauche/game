import type { CreatureDef } from '../types';

// Fantôme — gabarit spectral : tête nue translucide au visage éteint, voile bleu-blanc pâle.
export const creature: CreatureDef = {
  name: 'Fantôme',
  plan: 'spectral',
  aliases: ['fantome'],
  spectre: {
    sl: 0.95, hood: false, face: 'morne',
    stored: { corps: '#9fb8c8', corpsO: '#5a7282', corpsH: '#d8e8f0', cheveux: '#3a4a54', cheveuxO: '#222e34', cuir: '#7a90a0' },
  },
};
