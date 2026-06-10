import type { CombatFeature } from '../types';

// LDB 10 : pénalité de main secondaire -20 → -10 (1×) → 0 (2×).
export const feature: CombatFeature = { key: 'Ambidextre', kind: 'talent', modifyOffHandPenalty: (penalty, { level }) => (level >= 2 ? 0 : Math.min(0, penalty + 10)) };
