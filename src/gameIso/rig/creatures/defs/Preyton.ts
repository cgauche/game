import type { CreatureDef } from '../types';

// Preyton (ZI) — cervidé ailé maléfique (corps de cerf + grandes ailes emplumées, projette une
// ombre de cerf). Gabarit AILÉ : corps 'equine' élancé, tête 'cheval', sabots, ailes 'plumes'.
// Robe sombre vert-de-gris. (Bois non modélisés au catalogue → limitation connue.)
export const creature: CreatureDef = {
  name: 'Preyton',
  plan: 'winged',
  quad: {
    sl: 1.0, build: 'equine', girth: 0.9, bodyLen: 1.0, neckLen: 0.78, neckAngle: -34, legLen: 1.08,
    head: 'cheval', tail: 'crin', ears: 'pointues', foot: 'sabot', wings: 'plumes', wingSpan: 1.2, headScale: 0.92, tailLen: 0.7,
    stored: { corps: '#3a4438', corpsO: '#1f261d', corpsH: '#6a7660', cheveux: '#232a20', cheveuxO: '#121610', cuir: '#5a5440' },
  },
};
