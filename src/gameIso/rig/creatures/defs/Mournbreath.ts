import type { CreatureDef } from '../types';

// Fr'hough Mournbreath (Jabberslythe nommé) — variante brun-vert à BOIS ramifiés. 1 def.
// Canon LDB 79 l.103 : « ignoble mélange de crapaud, de dragon de vase et d'insecte », gabarit
// impressionnant et balourd, ailes bien trop petites pour le soulever, langue collante qui fouette.
// → corps bouffi vase putride (girth ↑↑ : la masse domine, les ailes paraissent dérisoires),
// contour quasi-noir (silhouette dure, verrues et nervures d'ailes marquées — fini le « jouet »),
// membrane d'aile pâle et froide qui TRANCHE sur la robe (lecture insecte, pas oreilles),
// langue-fouet allongée qui pend bien au-delà du cou, bois ramifiés couleur os sale.
export const creature: CreatureDef = {
  name: "Fr'hough Mournbreath",
  plan: 'jabberslythe',
  jabber: {
    sl: 1.05, girth: 1.32, antlers: true, tongue: 1.45,
    stored: { corps: '#5a5430', corpsO: '#211e0c', corpsH: '#e2ecd8', cheveux: '#3a3418', cheveuxO: '#1c180a', cuir: '#d8c693' },
  },
};
