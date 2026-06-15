import type { TraitDef } from '../types';

// LDB 85 p.343 : « Chaque fois qu'elle réussit à toucher, son adversaire gagne 1 État Empêtré, avec
// une Force de Indice. » Effet MÉCANIQUE migré en donnée éditable (`traits.json` → `effects` onHit,
// appliqué par state/triggeredEffects) ; cette def ne sert plus qu'à enregistrer la clé canonique.
export const trait: TraitDef = { key: 'Toile' };
