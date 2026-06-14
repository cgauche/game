import type { CreatureDef } from '../types';

// Esclave skaven : chair à canon famélique — haillons (tenue « Esclave skaven »), fourrure
// terne galeuse. Match restreint (« esclave » seul matcherait des humains).
export const creature: CreatureDef = {
  name: 'Esclave skaven',
  plan: 'biped',
  matchPriority: 12,
  aliases: ['esclave-skaven', 'esclaveskaven', 'skaven esclave', 'skaven-esclave', 'skavenesclave'],
  race: 'Skaven',
  perso: {
    career: 'Esclave skaven',
    gabarit: 'decharne', // affamé — carrure émaciée plutôt que celle du guerrier
    colors: { peau: '#7d7263', cheveux: '#3a3228' }, // fourrure terne
  },
};
