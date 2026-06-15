import type { QualityDef } from '../types';

// LDB 62 l.289-290 : « N'importe quel adversaire touché avec succès par votre arme gagne un État
// Empêtré avec une Force égale à votre Caractéristique de Force. » Effet MÉCANIQUE migré en donnée
// éditable (`qualities.json` → `effects` onHit, Force d'évasion = la Force de la source via
// `escapeStrength`, appliqué par state/triggeredEffects) ; cette def n'enregistre plus que la clé.
export const quality: QualityDef = { key: 'Immobilisante', type: 'Atout', subType: 'Arme' };
