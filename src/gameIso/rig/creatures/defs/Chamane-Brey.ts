import type { CreatureDef } from '../types';
import { OV_CORNES_GOR } from '../../parts/monstrous';

// Chamane-Bray (LDB 83, « Chamane-Brey » en data) : sorcier de la horde — « ils représentent
// la volonté des Dieux Sombres » (+ trait Cornes). Grandes cornes de gor (statut) = MORPHO ;
// son ÉQUIPEMENT (fétiches d'os, crâne votif) = tenue de carrière « Chamane-Bray » (registre,
// bareFoot — il garde les pattes de la race).
export const creature: CreatureDef = {
  name: 'Chamane-Brey',
  plan: 'biped',
  matchPriority: 24, // avant Gor (25) — « bray » contient parfois « gor » dans la phrase
  aliases: ['chamane bray', 'chamane-bray', 'chamanebray', 'chamane brey', 'chamanebrey', 'bray', 'brey'],
  race: 'Homme-bête',
  perso: {
    tenue: 'Chamane-Bray',
    features: [
      { bone: 'tete', svg: OV_CORNES_GOR, layer: -2 },
    ],
  },
};
