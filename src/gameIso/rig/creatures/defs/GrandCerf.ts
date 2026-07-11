import type { CreatureDef } from '../types';

// Grand Cerf (ZI) — être transcendant des forêts, « manifestation suprême de l'âme d'une forêt ».
// Réf art : art-ref/zi/page014_full.png — cerf MASSIF au pelage NOIR hirsute (longue toison de
// gorge et d'encolure), ramure démesurée à nombreux andouillers balayés vers le ciel, posture de
// bramement (encolure dressée). Quadrupède 'equine' porté en MASSE (girth/bodyLen hauts), crinière
// 'hirsute' = toison dressée dos/gorge/nuque/croupe, headgear 'bois' agrandi via headScale (le
// profil balaie les perches en arrière-haut, comme l'illustration tête levée). Robe charbon
// (@corps quasi noir), toison et ramure gris-taupe sombre (@cheveux, ton de la gravure).
export const creature: CreatureDef = {
  name: 'Grand Cerf',
  plan: 'quadruped',
  quad: {
    sl: 1.1, build: 'equine', girth: 1.14, bodyLen: 1.08, neckLen: 0.95, neckAngle: -58, legLen: 1.14,
    head: 'cheval', tail: 'touffe', mane: 'hirsute', ears: 'pointues', foot: 'sabot', headgear: 'bois', headScale: 1.18, tailLen: 0.5,
    stored: { corps: '#37322c', corpsO: '#15120e', corpsH: '#5d564a', cheveux: '#4e463a', cheveuxO: '#191410', cuir: '#221d17' },
  },
};
