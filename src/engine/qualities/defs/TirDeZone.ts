import type { QualityDef } from '../types';

// Tir de zone (Indice) (Aux Armes p.89) : nuage de projectiles. À bout portant (≤ 2 m) → +Indice
// Dégâts sur la cible ; à portée → frappe aussi les Indice créatures les plus proches (≤ Indice m).
export const quality: QualityDef = { key: 'Tir de zone', type: 'Atout', subType: 'Arme', areaFire: true };
