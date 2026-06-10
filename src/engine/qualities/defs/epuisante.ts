import type { QualityDef } from '../types';

// LDB 63 l.16-17 : « Vous ne gagnez les bénéfices des Traits d'arme Percutante et Dévastatrice
// que lors d'un Tour où vous Chargez. » (Gating consommé par qualityDamageStep via ctx.charged.)
export const quality: QualityDef = { key: 'Épuisante', type: 'Défaut', subType: 'Arme', chargeGatedDamageAtouts: true };
