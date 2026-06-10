import { COMBAT_FEATURES } from './registry';

/** Canonicalise un nom de talent/trait vers la clé du registre (insensible casse/espaces), ou null.
 *  Une spécialisation terminale (« Sans peur (Morts-vivants) ») est retirée en repli — la spec est
 *  portée séparément par `CombatFeatureCtx.spec` (featuresOf). */
export function featureKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  const exact = Object.keys(COMBAT_FEATURES).find((k) => k.toLowerCase() === n);
  if (exact) return exact;
  const base = n.replace(/\s*\([^)]*\)\s*$/, '');
  if (base === n) return null;
  return Object.keys(COMBAT_FEATURES).find((k) => k.toLowerCase() === base) ?? null;
}
