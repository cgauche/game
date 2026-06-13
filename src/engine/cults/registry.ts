/**
 * Registre des cultes (LDB 41) — DÉRIVÉ du registre `defs/` (gen-registry.mjs). Ajouter un dieu =
 * déposer `defs/<slug>.ts` (`export const cult: CultDef = { key, blessings }`) puis `npm run gen`
 * (auto en dev). SOURCE UNIQUE des Bénédictions par culte — remplace l'ancien record en dur.
 */
import type { CultDef } from './types';
import { CULT_DEFS } from './_registry.generated';

export type { CultDef } from './types';

/** Table des cultes par clé (« Sigmar » → CultDef). */
export const CULTS: Record<string, CultDef> = Object.fromEntries(CULT_DEFS.map((c) => [c.key, c]));

/** Labels complets des six Bénédictions d'un culte (« Bataille » → « Bénédiction de Bataille »). */
export function blessingsOf(cult: string): string[] {
  return (CULTS[cult]?.blessings ?? []).map((x) => `Bénédiction de ${x}`);
}
