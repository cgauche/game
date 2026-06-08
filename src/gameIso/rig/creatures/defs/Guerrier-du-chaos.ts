import type { CreatureDef } from '../types';
// Guerrier du Chaos : humanoïde massif en armure de plates sombre, heaume cornu. Race dédiée
// (sinon il lit comme un simple soldat humain).
export const creature: CreatureDef = {
  name: 'Guerrier du Chaos',
  plan: 'biped',
  matchPriority: 30,
  match: 'guerrier du chaos|chaos warrior|guerrier chaotique|elu du chaos|chevalier du chaos|champion du chaos',
};
