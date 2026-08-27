import type { CreatureDef } from '../types';

// Esclave skaven : chair à canon famélique — haillons (tenue « Esclave skaven »), fourrure
// terne galeuse. Match restreint (« esclave » seul matcherait des humains).
export const creature: CreatureDef = {
  label: 'Esclave skaven',
  id: "esclave-skaven",
  plan: 'biped',
  race: 'skaven',
  perso: {
    tenue: 'esclave-skaven',
    gabarit: 'decharne', // affamé — carrure émaciée plutôt que celle du guerrier
    colors: { peau: '#7d7263', cheveux: '#3a3228' }, // fourrure terne
  },
};
