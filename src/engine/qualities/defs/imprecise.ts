import type { QualityDef } from '../types';

// LDB 63 l.19-20 : « Subissez une pénalité de -1 DR quand vous utilisez l'arme pour attaquer.
// Une arme Imprécise ne peut jamais être également Précise (Imprécise prend le dessus). »
export const quality: QualityDef = { key: 'Imprécise', type: 'Défaut', subType: 'Arme', attackDR: -1, beats: ['Précise'] };
