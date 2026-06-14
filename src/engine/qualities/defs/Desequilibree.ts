import type { QualityDef } from '../types';

// Déséquilibrée (Aux Armes p.89) : poids concentré dans la tête → inefficace en parade.
// « -1 DR sur l'attaque opposée quand cette arme s'oppose à une attaque » → defenderParryDR -1.
export const quality: QualityDef = { key: 'Déséquilibrée', type: 'Défaut', subType: 'Arme', defenderParryDR: -1 };
