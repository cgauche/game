import { MERCHANT_ARCHETYPES } from './_registry.generated';
import type { MerchantArchetypeDef } from './types';

export type { MerchantArchetypeDef } from './types';
export { MERCHANT_ARCHETYPES };

/** Lookup par clé `name` (table dérivée du registre — pas à maintenir à la main). */
export const MERCHANTS: Record<string, MerchantArchetypeDef> = Object.fromEntries(
  MERCHANT_ARCHETYPES.map((m) => [m.name, m]),
);
