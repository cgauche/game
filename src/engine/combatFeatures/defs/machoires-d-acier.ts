import type { CombatFeature } from '../types';

// LDB 10 : « Chaque fois que vous gagnez un État Sonné ou plus […] Test de Résistance Intermédiaire (+0) pour en ignorer un, chaque DR supprimant un État Sonné » (résolu en fin de Round — granularité documentée).
export const feature: CombatFeature = { key: "Mâchoires d'acier", kind: 'talent', stunSave: true };
