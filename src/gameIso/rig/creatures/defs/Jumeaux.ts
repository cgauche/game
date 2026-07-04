import type { CreatureDef } from '../types';
import { appendageFeature } from '../../parts/appendages';

// Les Jumeaux (Compagnon T1 ch.12, cage 4) : « minuscules hommes-bêtes de moins de trente
// centimètres » d'une férocité disproportionnée. Trait Taille (Très petit) → ×0.6 au spawn ;
// l'art reste lisible (plancher de la toise). Match au PLURIEL seulement — « jumeau » nu
// désignerait des humains. Stats = campagne → CustomStatblock.
export const creature: CreatureDef = {
  name: 'Jumeaux',
  plan: 'biped',
  race: 'Homme-bête', // « jumeaux » (pluriel) = le nom ; « jumeau » nu désignerait des humains

  perso: {
    gabarit: 'gremlin', // dégingandé à grosse tête — la hargne minuscule
    scale: 0.62,
    features: [appendageFeature('cornes-vestigiales')],
  },
};
