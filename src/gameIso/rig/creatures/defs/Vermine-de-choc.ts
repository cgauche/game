import type { CreatureDef } from '../types';

// Vermine de choc (LDB) : ÉLITE skavenne — fourrure NOIRE (le tell canon des vermines de
// choc) + armure de lamelles régulières (tenue dédiée « Vermine de choc », tenues/defs/).
export const creature: CreatureDef = {
  name: 'Vermine de choc',
  plan: 'biped',
  matchPriority: 12, // avant le def Skaven générique
  aliases: ['vermine'], // « vermine de choc » = le nom ; « vermine » nu suffit (élite skavenne)
  race: 'Skaven',
  perso: {
    tenue: 'Vermine de choc',
    scale: 1.1, // « plus grands, plus forts… que les guerriers des clans » (LDB 84)
    colors: { peau: '#2e2a26', cheveux: '#15110e' }, // fourrure noire
  },
};
