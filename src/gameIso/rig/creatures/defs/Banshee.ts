import type { CreatureDef } from '../types';

// Banshee — gabarit spectral : capuche + bouche hurlante (cri), voile sombre violacé.
export const creature: CreatureDef = {
  name: 'Banshee',
  plan: 'spectral',
  aliases: ['banshee', 'pleureuse'],
  spectre: {
    sl: 0.96, hood: true, face: 'cri',
    stored: { corps: '#3a3550', corpsO: '#221f33', corpsH: '#6a5f88', cheveux: '#1a1726', cheveuxO: '#0e0c14', cuir: '#2e2a44' },
  },
};
