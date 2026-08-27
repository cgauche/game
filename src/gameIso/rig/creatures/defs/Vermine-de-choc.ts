import type { CreatureDef } from '../types';

// Vermine de choc (LDB) : ÉLITE skavenne — fourrure NOIRE (le tell canon des vermines de
// choc) + armure de lamelles régulières (tenue dédiée « Vermine de choc », tenues/defs/).
export const creature: CreatureDef = {
  label: 'Vermine de choc',
  id: "vermine-de-choc",
  plan: 'biped',
  race: 'skaven',
  perso: {
    tenue: 'vermine-de-choc',
    scale: 1.1, // « plus grands, plus forts… que les guerriers des clans » (LDB 84)
    colors: { peau: '#2e2a26', cheveux: '#15110e' }, // fourrure noire
  },
};
