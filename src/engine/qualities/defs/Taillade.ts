import type { QualityDef } from '../types';

// Taillade (XA) (Aux Armes p.89) : blessures béantes. Une Blessure Critique infligée avec cette
// arme ajoute un État Hémorragique (le « +1 par X Avantages » optionnel reste un choix non câblé).
export const quality: QualityDef = { key: 'Taillade', type: 'Atout', subType: 'Arme', onCritCondition: 'Hémorragique' };
