import type { QualityDef } from '../types';

// LDB 62 l.275-276 : « Au lieu de causer des Dégâts, une attaque réussie avec une arme Perturbante
// peut forcer un adversaire à reculer d'un mètre par DR obtenu au Test opposé. » (Mode d'attaque
// optionnel du héros — cf. combatFlow `pushbackMode` ; l'IA inflige des Dégâts normaux.)
export const quality: QualityDef = { key: 'Perturbante', type: 'Atout', subType: 'Arme', pushback: true };
