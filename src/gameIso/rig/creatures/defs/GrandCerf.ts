import type { CreatureDef } from '../types';

// Grand Cerf (ZI) — grand cervidé à grande ramure (« 6 à 14 ramifications, perce l'armure »).
// Quadrupède 'equine' élancé (encolure redressée, pattes hautes, sabots), bois ramifiés (headgear
// 'bois'), robe brun-roux. Réf art : art-ref/zi/page014_full.png.
export const creature: CreatureDef = {
  name: 'Grand Cerf',
  plan: 'quadruped',
  quad: {
    sl: 1.0, build: 'equine', girth: 0.88, bodyLen: 1.04, neckLen: 0.82, neckAngle: -36, legLen: 1.16,
    head: 'cheval', tail: 'crin', ears: 'pointues', foot: 'sabot', headgear: 'bois', headScale: 0.92, tailLen: 0.6,
    stored: { corps: '#8a5e38', corpsO: '#523620', corpsH: '#b78a56', cheveux: '#3a2818', cheveuxO: '#22160c', cuir: '#2c2620' },
  },
};
