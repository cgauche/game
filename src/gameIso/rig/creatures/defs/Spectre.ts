import type { CreatureDef } from '../types';

// Spectre (de cairn) — gabarit spectral : capuche dressée + crâne, robe verdâtre translucide.
export const creature: CreatureDef = {
  name: 'Spectre',
  plan: 'spectral',
  aliases: ['spectre', 'cairn', 'necarque', 'revenant', 'apparition', 'ombre', 'wraith'],
  spectre: {
    sl: 0.98, hood: true, face: 'crane',
    stored: { corps: '#7a9a8a', corpsO: '#46584e', corpsH: '#a8c8b8', cheveux: '#2e3a34', cheveuxO: '#1a221e', cuir: '#6a8478' },
  },
};
