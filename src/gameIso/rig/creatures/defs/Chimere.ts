import type { CreatureDef } from '../types';

// Chimère (ZI) — monstruosité ailée du Chaos (corps massif, ailes membraneuses, crinière). Gabarit
// AILÉ draconique : tête 'dragon', queue 'reptile', pieds 'serre', crinière 'hirsute', dorsale
// épineuse, ailes 'membrane'. Robe gris-rouge tachetée.
export const creature: CreatureDef = {
  name: 'Chimère',
  plan: 'winged',
  quad: {
    sl: 1.2, build: 'draconic', girth: 1.05, bodyLen: 1.05, neckLen: 0.8, neckAngle: -30, legLen: 0.9,
    head: 'dragon', tail: 'reptile', ears: 'pointues', foot: 'serre', wings: 'membrane', wingSpan: 1.25, mane: 'hirsute', ridge: 'epines', headScale: 1.08, tailLen: 1.2,
    stored: { corps: '#6a4a48', corpsO: '#382626', corpsH: '#9a7060', cheveux: '#4a2c2a', cheveuxO: '#281616', cuir: '#7a6a48' },
  },
};
