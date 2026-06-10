import type { CombatFeature } from './types';

/** Registre des capacités de combat (talents + traits). 1 entrée = 1 capacité ; clé = nom FR canonique. */
export const COMBAT_FEATURES: Record<string, CombatFeature> = {
  // Ambidextre (LDB 10 l.30-32) : pénalité de main secondaire -20 → -10 (1×) → 0 (2×).
  Ambidextre: {
    key: 'Ambidextre',
    kind: 'talent',
    modifyOffHandPenalty: (penalty, { level }) => (level >= 2 ? 0 : Math.min(0, penalty + 10)),
  },
  // Maniement de deux armes (LDB 10 l.638) : ajoute le mode d'attaque « des deux armes » (frappe off-hand
  // conditionnelle, d100 inversé). Maxi = Bonus d'Agilité (le niveau ne change pas l'effet → binaire).
  'Maniement de deux armes': {
    key: 'Maniement de deux armes',
    kind: 'talent',
    attackModes: () => ['dual-wield'],
  },
};
