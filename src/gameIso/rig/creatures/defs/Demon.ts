import type { CreatureDef } from '../types';
import { GRIFFES_ART } from '../../parts/elements/defs/griffes';

// Sanguinaire de Khorne (LDB 84 + illustration p.337) : « dents pointues et acérées […]
// monstrueux visage cornu ; peau rouge-sang dure comme l'airain » + trait Arme (griffes).
// CORPS NU via la race Démon (tête/cornes/musculature/jambes caprines) + griffes ADDITIVES ;
// son ÉQUIPEMENT (pagne loqueteux ceinturé) = tenue de carrière « Sanguinaire » (registre,
// bareFoot). La Lame des Enfers = l'arme équipée en scène.
export const creature: CreatureDef = {
  name: "Démon",
  plan: 'biped',
  perso: {
    tenue: 'Sanguinaire',
    features: [
      { bone: 'mainG', svg: GRIFFES_ART },
      { bone: 'mainD', svg: GRIFFES_ART },
    ],
  },
};
