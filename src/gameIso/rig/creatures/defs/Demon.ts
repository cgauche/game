import type { CreatureDef } from '../types';

// Sanguinaire de Khorne (LDB 84 + illustration p.337) : « dents pointues et acérées […]
// monstrueux visage cornu ; peau rouge-sang dure comme l'airain » + trait Arme (griffes).
// CORPS NU via la race Démon (tête/cornes/musculature/jambes caprines) — griffes aux mains =
// le Nu de la race griffue (`resolve.ts`, #736 Lot 3), plus un calque additif redondant.
// Son ÉQUIPEMENT (pagne loqueteux ceinturé) = tenue de carrière « Sanguinaire » (registre, ne
// chausse pas — race Démon griffue, #736 Lot 1). La Lame des Enfers = l'arme équipée en scène.
export const creature: CreatureDef = {
  label: "Démon",
  id: "demon",
  plan: 'biped',
  perso: {
    tenue: 'sanguinaire',
  },
};
