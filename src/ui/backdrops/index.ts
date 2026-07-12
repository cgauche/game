import type { BackdropDef } from './types';
import { BACKDROP_DEFS } from './_registry.generated';

export type { BackdropDef } from './types';
export { BACKDROP_DEFS };

/** Lookup par id (table dérivée du registre — pas à maintenir à la main). */
export const BACKDROPS: Record<string, BackdropDef> = Object.fromEntries(
  BACKDROP_DEFS.map((b) => [b.id, b]),
);
