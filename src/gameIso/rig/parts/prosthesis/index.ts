/**
 * Registre des PROTHÈSES, dérivé des `defs/` (1 prothèse = 1 fichier). Source unique de l'art de
 * prothèse/amputation, référencé par id depuis la machinerie de blessures (`injuries.ts`).
 */
import { PROSTHESIS_DEFS, type ProsthesisId } from './_registry.generated';

export type { ProsthesisId };
export type { ProsthesisDef } from './types';

/** id → art SVG (source unique). */
export const PROSTHESIS: Record<string, string> = Object.fromEntries(PROSTHESIS_DEFS.map((p) => [p.id, p.art]));
