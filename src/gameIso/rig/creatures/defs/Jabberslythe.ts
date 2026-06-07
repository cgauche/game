import type { CreatureDef } from '../types';

// Jabberslythe (générique + catch-all bêtes du Chaos informes) — gabarit jabberslythe : crapaud-
// dragon-insecte orange, ailes de libellule, langue-fouet, regard fou. Animé (bespoke).
export const creature: CreatureDef = {
  name: 'Jabberslythe',
  plan: 'jabberslythe',
  aliases: ['jabberslythe', 'jabberwock', 'nurgle', 'tzeentch', 'spawn', 'engeance', 'bete du chaos'],
  jabber: {
    sl: 1.15, girth: 1.0, antlers: false, tongue: 1,
    stored: { corps: '#c8682a', corpsO: '#8a4216', corpsH: '#e89a52', cheveux: '#6a3210', cheveuxO: '#3a1c08', cuir: '#caa23a' },
  },
};
