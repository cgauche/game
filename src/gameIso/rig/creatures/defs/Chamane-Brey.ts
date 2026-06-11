import type { CreatureDef } from '../types';
import { OV_CORNES_GOR } from '../../parts/monstrous';

// Chamane-Bray (LDB 83, « Chamane-Brey » en data) : sorcier de la horde — « ils représentent
// la volonté des Dieux Sombres » (+ trait Cornes). Grandes cornes de gor (statut) + fétiches
// d'os au poitrail (collier d'osselets, crâne votif) — le marqueur visuel du lanceur de sorts.
const OV_FETICHES =
  `<path d="M-9 -25 Q0 -19 9 -25" stroke="#3a2a1a" stroke-width="1.1" fill="none"/>`
  + `<path d="M-6.6 -22.4 l0 3.4 M-3.4 -21.2 l0 3.8 M3.4 -21.2 l0 3.8 M6.6 -22.4 l0 3.4" stroke="#ddd2b6" stroke-width="1.6" stroke-linecap="round"/>`
  + `<path d="M-2 -21 Q-2.4 -16.4 0 -16 Q2.4 -16.4 2 -21 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`
  + `<circle cx="-0.8" cy="-18.6" r="0.45" fill="#1a0e06"/><circle cx="0.8" cy="-18.6" r="0.45" fill="#1a0e06"/>`
  + `<path d="M-0.7 -16.8 l1.4 0" stroke="#1a0e06" stroke-width="0.4"/>`;

export const creature: CreatureDef = {
  name: 'Chamane-Brey',
  plan: 'biped',
  matchPriority: 24, // avant Gor (25) — « bray » contient parfois « gor » dans la phrase
  match: 'chamane.?br[ae]y|\\bbr[ae]y\\b',
  race: 'Homme-bête',
  perso: {
    features: [
      { bone: 'tete', svg: OV_CORNES_GOR, layer: -2 },
      { bone: 'torse', svg: OV_FETICHES, scale: 'bone', layer: 60 },
    ],
  },
};
