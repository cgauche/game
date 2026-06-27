import type { CreatureDef } from '../types';

// Cornu (ZI) — reptile trapu à sang froid, CORNU (son trait identitaire). Quadrupède draconique massif
// et bas, tête 'dragon' (reptilienne, une seule) coiffée de cornes courbées (headgear 'cornes'), queue
// 'reptile', dorsale en crête, pieds 'serre'. Robe grise écailleuse.
export const creature: CreatureDef = {
  name: 'Cornu',
  plan: 'quadruped',
  quad: {
    sl: 1.05, build: 'draconic', girth: 1.12, bodyLen: 1.04, neckLen: 0.52, neckAngle: -12, legLen: 0.66,
    head: 'dragon', tail: 'reptile', mane: 'sans', ears: 'courtes', foot: 'serre', ridge: 'crete', headgear: 'cornes', headScale: 1.06, tailLen: 1.0,
    stored: { corps: '#69706a', corpsO: '#383d39', corpsH: '#969c92', cheveux: '#474c46', cheveuxO: '#262a26', cuir: '#7c6c4e' },
  },
};
