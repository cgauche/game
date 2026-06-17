import type { QualityDef } from '../types';

// L'effet « à la touche » (Tête → Test opposé F vs E/Résistance → Sonné) est un `effects` AUTHORÉ
// (qualities.json → `QualityData.effects`), dispatché par `fireTriggers('onHit')`.
export const quality: QualityDef = { "key": "Assommante", "type": "Atout", "subType": "Arme" };
