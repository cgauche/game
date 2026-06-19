import type { CreatureDef } from '../types';

// Cornu (ZI) — reptile trapu à sang froid. Quadrupède draconique massif et bas, tête 'hydre',
// queue 'reptile', dorsale en crête, pieds 'serre'. Robe grise écailleuse. (Cornes non encore
// modélisées au catalogue quad → limitation connue.)
export const creature: CreatureDef = {
  name: 'Cornu',
  plan: 'quadruped',
  quad: {
    sl: 1.05, build: 'draconic', girth: 1.12, bodyLen: 1.04, neckLen: 0.52, neckAngle: -12, legLen: 0.66,
    head: 'hydre', tail: 'reptile', ears: 'courtes', foot: 'serre', ridge: 'crete', headScale: 1.06, tailLen: 1.0,
    stored: { corps: '#69706a', corpsO: '#383d39', corpsH: '#969c92', cheveux: '#474c46', cheveuxO: '#262a26', cuir: '#7c6c4e' },
  },
};
