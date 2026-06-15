import type { QualityDef } from '../types';

// Infecté (Aux Armes p.102) : munition souillée (ferraille/débris). Non définie en propre par le
// livre — interprétation fidèle : un héros blessé est EXPOSÉ à l'infection (Test de Contraction
// post-combat, LDB 18), comme le Trait de créature « Infecté ». Lu par combatFlow (woundedByInfected).
export const quality: QualityDef = { key: 'Infecté', type: 'Défaut', subType: 'Arme' };
