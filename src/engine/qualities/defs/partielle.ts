import type { QualityDef } from '../types';

// LDB 63 (Qualités des armures) : « Un adversaire qui obtient un nombre pair pour vous toucher,
// ou obtient un Coup Critique, ignore les PA de l'armure Partielle. » Consommé par la mitigation
// (items.ignoredArmourAP → woundsFromHit).
export const quality: QualityDef = { key: 'Partielle', type: 'Défaut', subType: 'Armure', apIgnoredOnEven: true };
