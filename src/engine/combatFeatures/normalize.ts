import { COMBAT_FEATURES } from './registry';

/** Canonicalise un nom de talent/trait vers la clé du registre (insensible casse/espaces), ou null. */
export function featureKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  return Object.keys(COMBAT_FEATURES).find((k) => k.toLowerCase() === n) ?? null;
}
