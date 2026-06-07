import type { CreatureDef } from '../types';

// Serpent (gabarit serpentin) — corps lové + tête de cobra qui ondule. 1 fichier, rempli.
export const creature: CreatureDef = {
  name: 'Serpent',
  plan: 'serpentine',
  aliases: ['serpent', 'vipere', 'cobra', 'python', 'naga', 'couleuvre'],
  serpent: {
    sl: 1.0, girth: 1.0, hood: true,
    stored: { corps: '#5a7a44', corpsO: '#37502a', corpsH: '#82a05e', cheveux: '#2c3a20', cheveuxO: '#1a2410', cuir: '#caa23a' },
  },
};
