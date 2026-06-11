import type { CreatureDef } from '../types';

// Jabberslythe (générique + catch-all bêtes du Chaos informes) — gabarit jabberslythe.
// Canon LDB 79 l.103 : « ignoble mélange de crapaud, de dragon de vase et d'insecte », gabarit
// impressionnant et balourd (Taille Énorme), ailes bien trop petites pour le soulever, langue
// collante qui fouette, regard qui rend fou. → corps bouffi vert vase verruqueux (girth fort :
// la base des ailes disparaît derrière la masse = petites ailes, pas des oreilles), membrane
// d'aile cyan pâle translucide nervurée (l'insecte), langue-fouet qui dépasse le corps et boucle
// dans le vide (le fouet). Pas de bois : le canon n'en mentionne pas. Animé (bespoke).
export const creature: CreatureDef = {
  name: 'Jabberslythe',
  plan: 'jabberslythe',
  aliases: ['jabberslythe', 'jabberwock', 'nurgle', 'tzeentch', 'spawn', 'engeance', 'bete du chaos'],
  jabber: {
    sl: 1.15, girth: 1.45, antlers: false, tongue: 2.8,
    stored: { corps: '#5d6e30', corpsO: '#2c3815', corpsH: '#c2e9f2', cheveux: '#41512a', cheveuxO: '#222c12', cuir: '#b3a173' },
  },
};
