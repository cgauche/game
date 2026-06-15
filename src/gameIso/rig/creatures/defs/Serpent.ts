import type { CreatureDef } from '../types';

// Serpent (gabarit serpentin) — vipère des forêts profondes de l'Empire (LDB 79 l.5-6) :
// venin mortel ou constriction, proportions potentiellement gigantesques. Corps lové massif
// (constricteur), pas de capuchon de cobra (rendait comme des « oreilles »), robe vert forêt
// contrastée.
export const creature: CreatureDef = {
  name: 'Serpent',
  plan: 'serpentine',
  serpent: {
    sl: 1.0, girth: 1.12, hood: false,
    stored: { corps: '#5e8a3f', corpsO: '#2c4520', corpsH: '#93b65a', cheveux: '#2c3a20', cheveuxO: '#1a2410', cuir: '#caa23a' },
  },
};
