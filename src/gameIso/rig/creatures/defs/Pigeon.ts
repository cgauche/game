import type { CreatureDef } from '../types';

// Pigeon / petit oiseau (gabarit aviaire) — dodeline, recolore en corbeau/rouge-gorge. 1 fichier.
export const creature: CreatureDef = {
  name: 'Pigeon',
  plan: 'avian',
  aliases: ['pigeon', 'oiseau', 'corbeau', 'colombe', 'moineau', 'corneille'],
  bird: {
    sl: 0.62, girth: 1.0,
    stored: { corps: '#7c8a99', corpsO: '#4e5a66', corpsH: '#c2ccd4', cheveux: '#3a444e', cheveuxO: '#222a30', cuir: '#d06a26' },
  },
};
