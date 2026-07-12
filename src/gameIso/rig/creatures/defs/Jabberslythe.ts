import type { CreatureDef } from '../types';

// Jabberslythe — gabarit jabberslythe, silhouette calée sur l'artwork officiel
// (art-ref/ldb/page324_img7750.png ; canon texte : LDB 79 l.103) : QUADRUPÈDE massif écailleux
// vert vase à dorsale d'épines et ocelles, GRANDES ailes membraneuses rouille déployées en
// éventail (famille @aile), collerette hirsute rousse autour du cou, tête reptilienne à grandes
// CORNES recourbées et gueule BÉANTE hérissée de crocs, langue-fouet barbelée, longue queue
// annelée finie en DARD de scorpion. Pas de bois (les cornes vivent dans la tête de base).
export const creature: CreatureDef = {
  name: 'Jabberslythe',
  plan: 'jabberslythe',
  jabber: {
    sl: 1.15, girth: 1.45, antlers: false, tongue: 2,
    stored: {
      corps: '#5d6b32', corpsO: '#2c3815', corpsH: '#b9c47a', cheveux: '#9a4a24', cheveuxO: '#4c2210',
      aile: '#8f4430', aileO: '#4a2014', aileH: '#c47a52', // membrane rouille de l'artwork
      cuir: '#b3a173',
    },
  },
};
