import type { CreatureDef } from '../types';

// Le Déchiqueteur de Cadavres (ZI) — saurien charognard à écailles changeant de couleur (trait
// Perturbant). Quadrupède draconique élancé, tête 'dragon', queue 'reptile', dorsale épineuse,
// pieds 'serre'. Robe vert-violet irisée.
export const creature: CreatureDef = {
  name: 'Le Déchiqueteur de Cadavres',
  plan: 'quadruped',
  quad: {
    sl: 1.0, build: 'draconic', girth: 0.95, bodyLen: 1.05, neckLen: 0.6, neckAngle: -20, legLen: 0.8,
    head: 'dragon', tail: 'reptile', ears: 'pointues', foot: 'serre', ridge: 'epines', headScale: 1.05, tailLen: 1.2,
    stored: { corps: '#4e6a52', corpsO: '#2a3a2e', corpsH: '#9a7ec0', cheveux: '#3a4e3e', cheveuxO: '#1e2a20', cuir: '#7a6a48' },
  },
};
