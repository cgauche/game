/**
 * Résolution de VARIANTES réglées (#563/#564 — doctrine user 2026-07-17 : « jamais 2 talents
 * différents », les règles optionnelles activent une variante de la MÊME entrée). `when.rule`
 * référence LE registre `OPTIONAL_RULES` (`src/engine/policy.ts:43`), lu par `rule(id)` — jamais un
 * booléen/flag parallèle (garde #564, `scripts/guards`).
 */
import type { Variant } from '../data/schemas/common';
import { rule } from './policy';

/** Première variante dont la règle `when.rule` est à l'état `when.equals` (défaut `true` — règle
 *  `kind:'flag'` activée). `undefined` si aucune variante n'est active (forme LDB de base). */
export function activeVariant(variants: Variant[] | undefined): Variant | undefined {
  if (!variants) return undefined;
  return variants.find((v) => rule(v.when.rule) === (v.when.equals ?? true));
}
