import type { CombatFeature } from './types';

/** Registre des capacités de combat (talents + traits). 1 entrée = 1 capacité ; clé = nom FR canonique. */
export const COMBAT_FEATURES: Record<string, CombatFeature> = {
  // Ambidextre (LDB 10 l.30-32) : pénalité de main secondaire -20 → -10 (1×) → 0 (2×).
  Ambidextre: {
    key: 'Ambidextre',
    kind: 'talent',
    modifyOffHandPenalty: (penalty, { level }) => (level >= 2 ? 0 : Math.min(0, penalty + 10)),
  },
};
