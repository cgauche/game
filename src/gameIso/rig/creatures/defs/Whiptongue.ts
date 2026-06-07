import type { CreatureDef } from '../types';

// Slenderthigh Whiptongue (Jabberslythe nommé) — variante ROUGE à LANGUE-FOUET démesurée. 1 def.
export const creature: CreatureDef = {
  name: 'Slenderthigh Whiptongue',
  plan: 'jabberslythe',
  aliases: ['whiptongue', 'slenderthigh'],
  jabber: {
    sl: 1.18, girth: 0.92, antlers: false, tongue: 2.1,
    stored: { corps: '#b0322a', corpsO: '#741816', corpsH: '#d6584a', cheveux: '#5a1410', cheveuxO: '#360c0a', cuir: '#c8a838' },
  },
};
