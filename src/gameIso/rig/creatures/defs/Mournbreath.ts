import type { CreatureDef } from '../types';

// Fr'hough Mournbreath (Jabberslythe nommé) — variante brun-vert à BOIS ramifiés. 1 def.
export const creature: CreatureDef = {
  name: "Fr'hough Mournbreath",
  plan: 'jabberslythe',
  aliases: ['mournbreath', 'frhough'],
  jabber: {
    sl: 1.05, girth: 1.08, antlers: true, tongue: 0.8,
    stored: { corps: '#6e7038', corpsO: '#42441e', corpsH: '#969a56', cheveux: '#3a3a1c', cheveuxO: '#22220e', cuir: '#b8a85a' },
  },
};
