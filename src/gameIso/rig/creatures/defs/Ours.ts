import type { CreatureDef } from '../types';

// Ours — réf art : art-ref/ldb/page317_img7357.png : masse basse sur pattes-poteaux, bosse
// d'épaule, TÊTE LARGE rugissante (gueule ouverte, crocs, petites oreilles rondes), pelage
// dense grisonnant (dos clair paille, dessous sombre) balafré de coups de griffes à l'épaule.
// Build 'ursine' (tête 'ours' = crâne large + gueule béante, pelage hérissé dessiné dans le
// tronc), crinière 'hirsute' (toison de nuque/gorge), grosse tête focale (headScale).
export const creature: CreatureDef = {
  name: 'Ours',
  plan: 'quadruped',
  quad: {
    sl: 1.05, build: 'ursine', girth: 1.18, bodyLen: 0.88, neckLen: 0.46, neckAngle: -12, legLen: 0.78,
    head: 'ours', tail: 'courte', ears: 'rondes', foot: 'patte', mane: 'hirsute', headScale: 1.24,
    stored: { corps: '#6b5838', corpsO: '#38290f', corpsH: '#a89361', cheveux: '#8a744a', cheveuxO: '#4a3a22', cuir: '#15100a' },
  },
};
