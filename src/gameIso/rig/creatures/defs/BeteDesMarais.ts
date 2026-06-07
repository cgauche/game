import type { CreatureDef } from '../types';

// Bête des marais — gabarit amorphe/hulk : masse de tourbe boursouflée à plusieurs yeux + gueule,
// moignons, dégoulinures. 1 fichier rempli. Le gabarit `amorphous` est réutilisable (golems de
// boue, oozes, fenbeasts, spawn informes) — il suffira d'un def de plus.
export const creature: CreatureDef = {
  name: 'Bête des marais',
  plan: 'amorphous',
  aliases: ['bete des marais', 'fenbeast', 'golem de boue', 'limon'],
  hulk: {
    sl: 1.1, girth: 1.0,
    stored: { corps: '#5a5236', corpsO: '#362f1e', corpsH: '#7c7150', cheveux: '#2a2416', cheveuxO: '#181206', cuir: '#3a3320' },
  },
};
