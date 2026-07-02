import { ICON_FAMILIES } from './_registry.generated';
import type { IconDef, IconId } from './types';

export type { IconDef, IconFamily, IconId } from './types';

/** Registre à plat : id → def (unicité des ids garantie par icons.test.ts). */
export const ICON_DEFS: Record<IconId, IconDef> = Object.fromEntries(
  ICON_FAMILIES.flat().map((d) => [d.id, d]),
);
