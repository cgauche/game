import type { CreatureDef } from '../types';

// Carnosaure (ZI) — grand prédateur saurien. Quadrupède draconique (sans ailes) : encolure portée,
// tête 'dragon', longue queue 'reptile', pieds 'serre', dorsale épineuse. Robe écailleuse rouge-brun sombre.
export const creature: CreatureDef = {
  name: 'Carnosaure',
  plan: 'quadruped',
  quad: {
    sl: 1.2, build: 'draconic', girth: 1.0, bodyLen: 1.16, neckLen: 0.7, neckAngle: -30, legLen: 0.95,
    head: 'dragon', tail: 'reptile', mane: 'sans', ears: 'courtes', foot: 'serre', ridge: 'epines', headScale: 1.15, tailLen: 1.3,
    stored: { corps: '#6e4738', corpsO: '#3c241c', corpsH: '#9a6a4e', cheveux: '#4a2c20', cheveuxO: '#281610', cuir: '#7a6240' },
  },
};
