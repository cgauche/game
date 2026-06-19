import type { CreatureDef } from '../types';

// Lion de Guerre de Chrace (ZI) — grand félin de guerre à crinière. Quadrupède félin (build 'feline',
// queue 'leonine', crinière 'hirsute'), tête 'loup' (la plus proche au catalogue). Robe fauve.
export const creature: CreatureDef = {
  name: 'Lion de Guerre de Chrace',
  plan: 'quadruped',
  quad: {
    sl: 1.0, build: 'feline', girth: 1.05, bodyLen: 1.05, neckLen: 0.6, neckAngle: -10, legLen: 0.85,
    head: 'loup', tail: 'leonine', ears: 'rondes', foot: 'patte', mane: 'hirsute', headScale: 1.12, tailLen: 1.25,
    stored: { corps: '#c0924c', corpsO: '#6c4820', corpsH: '#e4c182', cheveux: '#7a4e20', cheveuxO: '#462a10', cuir: '#382a16' },
  },
};
