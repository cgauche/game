import type { CreatureDef } from '../types';
import { OV_GRIFFES } from '../../parts/monstrous';

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
      { bone: 'mainG', svg: OV_GRIFFES },
      { bone: 'mainD', svg: OV_GRIFFES },
    ],
  },
};
