import type { CreatureDef } from '../types';

// Esclave skaven : chair à canon famélique — haillons (tenue « Esclave skaven »), fourrure
// terne galeuse. Match restreint (« esclave » seul matcherait des humains).
export const creature: CreatureDef = {
  name: 'Esclave skaven',
  plan: 'biped',
  race: 'Skaven',
  perso: {
    tenue: 'esclave-skaven',
    gabarit: 'decharne', // affamé — carrure émaciée plutôt que celle du guerrier
    colors: { peau: '#7d7263', cheveux: '#3a3228' }, // fourrure terne
  },
};
