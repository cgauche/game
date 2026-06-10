import type { QualityDef } from '../types';

// LDB 63 l.13-14 : « Tout Test raté incluant un 9 sur le dé des dizaines ou des unités entraîne
// une Maladresse. » (Étend la détection de Maladresse — cf. oups.ts isFumbleWith.)
export const quality: QualityDef = { key: 'Dangereuse', type: 'Défaut', subType: 'Arme', fumbleOn9: true };
