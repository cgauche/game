import type { Combatant } from '../types';
import { COMBAT_FEATURES } from './registry';
import { featureKey } from './normalize';
import type { CombatFeature, CombatFeatureCtx } from './types';

/** Capacités du registre présentes sur le combattant (talents ; traits à brancher plus tard), avec niveau. */
export function featuresOf(c: Combatant): { def: CombatFeature; ctx: CombatFeatureCtx }[] {
  const out: { def: CombatFeature; ctx: CombatFeatureCtx }[] = [];
  for (const t of c.talents ?? []) {
    const k = featureKey(t.name);
    if (k) out.push({ def: COMBAT_FEATURES[k], ctx: { combatant: c, level: t.times ?? 1 } });
  }
  return out;
}

/** Pénalité de main secondaire (LDB 14 l.181 : -20), transformée par les capacités (Ambidextre → -10/0). */
export function offHandPenalty(c: Combatant): number {
  let pen = -20;
  for (const { def, ctx } of featuresOf(c)) {
    if (def.modifyOffHandPenalty) pen = def.modifyOffHandPenalty(pen, ctx);
  }
  return pen;
}
