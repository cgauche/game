import type { CreatureDef } from '../types';

// Bête des marais — gabarit amorphe/hulk : masse de tourbe boursouflée à plusieurs yeux + gueule,
// moignons, dégoulinures. 1 fichier rempli. Le gabarit `amorphous` est réutilisable (golems de
// boue, oozes, fenbeasts, spawn informes) — il suffira d'un def de plus.
export const creature: CreatureDef = {
  name: 'Bête des marais',
  plan: 'amorphous',
  aliases: ['bete des marais', 'fenbeast', 'golem de boue', 'limon'],
  // LDB 79 l.26-31 : « constitués de boue, d'os, de branches et de mucus », Taille (Grande) —
  // boue de tourbe BRUNE (pas vert crapaud), contour presque noir (silhouette), reflets de mucus
  // verdâtre. girth 0.9 : masse plus HAUTE que large (« vaguement humanoïdes ») et qui ne recouvre
  // plus les moignons de bras (pointe ±28px, non scalée) → deux bras pendants lisibles, ancrés.
  hulk: {
    sl: 1.1, girth: 0.9,
    stored: { corps: '#473828', corpsO: '#1a120a', corpsH: '#74804a', cheveux: '#2a2416', cheveuxO: '#181206', cuir: '#3a2e1c' },
  },
};
