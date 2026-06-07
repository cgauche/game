import type { CreatureDef } from '../types';

// Squig (des cavernes) — gabarit squig : boule rouge dominée par une gueule à crocs qui claque,
// crête d'épines, petites pattes. 1 fichier rempli (plus de sprite monolithique).
export const creature: CreatureDef = {
  name: 'Squig',
  plan: 'squig',
  aliases: ['squig'],
  squig: {
    sl: 0.85, girth: 1.0,
    stored: { corps: '#a82828', corpsO: '#6e1616', corpsH: '#d85a4a', cheveux: '#5a1010', cheveuxO: '#3a0a0a', cuir: '#2a2018' },
  },
};
