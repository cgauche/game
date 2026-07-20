import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Chamane-Bray (LDB 83, « Chamane-Brey » en data) : sorcier de la horde — « ils représentent
// la volonté des Dieux Sombres » (+ trait Cornes). Grandes cornes de gor (statut) = MORPHO ;
// son ÉQUIPEMENT (fétiches d'os, crâne votif) = tenue de carrière « Chamane-Bray » (registre,
// bareFoot — il garde les pattes de la race).
export const creature: CreatureDef = {
  label: 'Chamane-Brey',
  id: "chamane-brey",
  plan: 'biped',
  race: 'Homme-bête',
  perso: {
    tenue: 'chamane-bray',
    features: [
      appendageFeature('cornes-gor'),
    ],
  },
};
