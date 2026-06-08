import type { GabaritDef } from './types';
import { GABARIT_DEFS } from './_registry.generated';
export type { GabaritDef } from './types';
export const GABARITS: Record<string, GabaritDef> = Object.fromEntries(GABARIT_DEFS.map((g) => [g.id, g]));
export function gabaritById(id: string): GabaritDef { return GABARITS[id] ?? GABARITS.moyen; }
