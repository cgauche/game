import type { CreatureDef } from '../types';

// Il Potente Granchio (ZI p.92) — crabe géant de Tilée (Casa di Ruggicor), pinces +13, Taille
// Énorme. Même gabarit crustacé que le Léviathan, robe rouge-orangé de crabe.
export const creature: CreatureDef = {
  name: 'Il Potente Granchio',
  plan: 'crustace',
  crab: {
    sl: 1.1, girth: 1.16,
    stored: { corps: '#a8502e', corpsO: '#5e2818', corpsH: '#dc844a', cheveux: '#5e2818', cheveuxO: '#34160c', cuir: '#d8b89a' },
  },
};
