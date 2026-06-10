import type { TraitDef } from '../types';

// LDB 85 p.338 : « Si elle gagne un Test opposé en se défendant dans un Combat au Corps à corps,
// elle cause autant de Dégâts que si elle était l'attaquant. »
export const trait: TraitDef = { key: 'Champion', championDefense: true };
