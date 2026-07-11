import type { CreatureDef } from '../types';

// Chimère (ZI p.66) — trois têtes DISTINCTES (léonine à crinière + grand rapace + dragon),
// cluster `head: 'chimere'` sur le mécanisme de l'hydre. Corps « d'énorme chat difforme »
// massif (build ursine, girth fort), larges pattes à griffes incurvées ('patte'), GRANDES
// ailes membraneuses (wingSpan↑), longue queue épineuse, dorsale d'épines. Robe gris-argent
// de l'artwork (fourrure grise hirsute, crinière pâle, ombres ardoise).
export const creature: CreatureDef = {
  name: 'Chimère',
  plan: 'winged',
  quad: {
    sl: 1.25, build: 'ursine', girth: 1.3, bodyLen: 1.12, neckLen: 1.0, neckAngle: -30, legLen: 0.85,
    head: 'chimere', tail: 'reptile', ears: 'pointues', foot: 'patte', wings: 'membrane', wingSpan: 1.6,
    mane: 'hirsute', ridge: 'epines', tailLen: 1.3,
    stored: { corps: '#8b8779', corpsO: '#45463f', corpsH: '#c8c2ae', cheveux: '#d6cfbd', cheveuxO: '#77705e', cuir: '#4e483c' },
  },
};
