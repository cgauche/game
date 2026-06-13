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

/** Noms des cultes disponibles (pour le choix de divinité à la création). */
export const CULT_KEYS: string[] = CULT_DEFS.map((c) => c.key).sort();

/** Les six Bénédictions d'un culte, libellés complets (« Bénédiction de Bataille »). */
export function blessingsOf(cult: string): string[] {
  return CULTS[cult]?.blessings ?? [];
}

/** Les Miracles d'un culte (« Invitation »…). */
export function miraclesOf(cult: string): string[] {
  return CULTS[cult]?.miracles ?? [];
}
