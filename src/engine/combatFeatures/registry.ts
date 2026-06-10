/**
 * Registre des capacités conférées par les TALENTS (LDB 10) — DÉRIVÉ du registre `defs/`
 * (gen-registry.mjs), même patron que `engine/qualities`. Ajouter un talent à effet de jeu =
 * déposer `defs/<slug>.ts` (`export const feature: CombatFeature = { key, … }`) puis `npm run gen`.
 * Les helpers de `dispatch.ts` lisent `COMBAT_FEATURES` ; combat/combatFlow/rollFlows les consomment.
 */
import type { CombatFeature } from './types';
import { FEATURE_DEFS } from './_registry.generated';

export const COMBAT_FEATURES: Record<string, CombatFeature> = Object.fromEntries(FEATURE_DEFS.map((f) => [f.key, f]));
