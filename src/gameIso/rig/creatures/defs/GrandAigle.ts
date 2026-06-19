import type { CreatureDef } from '../types';

// Grand Aigle (ZI) — rapace géant (Taille Énorme au record → ×2.7 au spawn). Gabarit aviaire
// (silhouette d'oiseau recolorée), plumage brun sombre + tête/nuque dorées, bec et serres jaunes.
export const creature: CreatureDef = {
  name: 'Grand Aigle',
  plan: 'avian',
  bird: {
    sl: 1.05, girth: 1.0, tailLen: 1.1,
    stored: { corps: '#5a4632', corpsO: '#32261a', corpsH: '#caa868', cheveux: '#3a2c1c', cheveuxO: '#201610', cuir: '#e0a82c' },
  },
};
