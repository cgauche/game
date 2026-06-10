import type { QualityDef } from '../types';

// LDB 63 (Qualités des armures) : « Si votre adversaire possède une arme avec l'Atout Empaleuse
// et obtient un Critique, les PA de votre armure sont ignorés. » Consommé par la mitigation
// (items.ignoredArmourAP → woundsFromHit).
export const quality: QualityDef = { key: 'Points faibles', type: 'Défaut', subType: 'Armure', apIgnoredOnImpaleCrit: true };
