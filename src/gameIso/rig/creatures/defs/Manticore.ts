import type { CreatureDef } from '../types';

// Manticore (LDB 79 l.108, artwork LDB p.324) : gueule FÉLINE cerclée d'une crinière rousse
// flamboyante (@cheveux) à grands crocs (tête 'felin'), avant-train ÉCAILLEUX bleu-gris à
// dorsale d'épines (build 'draconic'), grandes ailes de chauve-souris DRESSÉES à demi-ouvertes
// (membrane + wingPose 'dressees'), longue queue SEGMENTÉE arquée au-dessus du dos finie en
// DARD de scorpion (queue 'dard'). Gabarit AILÉ — distinct du griffon (cuir vs plumes).
export const creature: CreatureDef = {
  name: 'Manticore',
  plan: 'winged',
  quad: {
    sl: 1.15, build: 'draconic', girth: 1.0, bodyLen: 1.06, neckLen: 0.6, neckAngle: -22, legLen: 0.95,
    head: 'felin', headScale: 1.25, tail: 'dard', tailLen: 1.15, ears: 'rondes', foot: 'patte',
    wings: 'membrane', wingSpan: 1.45, wingPose: 'dressees', mane: 'hirsute', ridge: 'epines',
    stored: { corps: '#5c6478', corpsO: '#303648', corpsH: '#8f96aa', cheveux: '#c25a1e', cheveuxO: '#7b330f', cuir: '#3f3a4c' },
  },
};
