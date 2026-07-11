import type { CreatureDef } from '../types';

// Dragon (LDB 79 l.42-50 : « immenses », Taille Énorme, Vol 80, Attaque caudale) — fidélité à
// l'artwork officiel (art-ref/ldb/page321_img7598.png) : écailles rouge/bordeaux crevassées,
// grandes ailes MEMBRANEUSES, long cou serpentin dressé, gueule allongée pleine de crocs, cornes
// courbées d'ivoire verdâtre balayées en arrière (headgear 'cornes' + pics du crâne), très longue
// queue épineuse qui traîne, pattes musclées à serres. Encolure quasi verticale : le museau reste
// DANS la boîte 120×150 (penchée à -40° il sortait du cadre → « museau lisse sans crocs »).
export const creature: CreatureDef = {
  name: 'Dragon',
  plan: 'winged',
  quad: {
    sl: 1.25, build: 'draconic', girth: 1.05, bodyLen: 1.02, neckLen: 1.2, neckAngle: -6,
    legLen: 0.97, head: 'dragon', headScale: 1.15, headgear: 'cornes', tail: 'reptile', tailLen: 1.7,
    ears: 'pointues', foot: 'serre', wings: 'membrane', wingSpan: 1.42, mane: 'sans', ridge: 'epines',
    stored: { corps: '#93392e', corpsO: '#4a1512', corpsH: '#c96f4e', cheveux: '#b4bd93', cheveuxO: '#6b7350', cuir: '#4c3128' },
  },
};
