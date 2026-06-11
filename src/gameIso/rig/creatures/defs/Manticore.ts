import type { CreatureDef } from '../types';

// Manticore (LDB 79 l.108) : tête et corps de grand chat, ailes de chauve-souris
// (membrane), queue-fouet hérissée de barbelés ; crinière de lion (l.112). Gabarit AILÉ —
// distinct du griffon : ailes de CUIR vs plumes, tête de fauve à crinière vs aigle.
export const creature: CreatureDef = {
  name: 'Manticore',
  plan: 'winged',
  quad: {
    sl: 1.1, build: 'feline', girth: 1.06, bodyLen: 1.02, neckLen: 0.62, neckAngle: -24, legLen: 0.98,
    head: 'ours', headScale: 1.15, tail: 'fouet', tailLen: 1.45, ears: 'courtes', foot: 'patte',
    wings: 'membrane', wingSpan: 1.4, mane: 'hirsute', ridge: 'epines',
    stored: { corps: '#a4502e', corpsO: '#6b2f1a', corpsH: '#c97a4a', cheveux: '#2a1812', cheveuxO: '#170d08', cuir: '#5a4630' },
  },
};
