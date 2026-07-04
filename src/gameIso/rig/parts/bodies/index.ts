/**
 * Registre des CORPS de base, dérivé des `defs/` (1 corps = 1 fichier). Source unique de la chair nue
 * pour composer les tenues de monstres. Référencé par id (ex. `BODIES.nu.torseFront`).
 */
import type { BodyDef } from './types';
import { BODY_DEFS, type BodyId } from './_registry.generated';

export type { BodyId, BodyDef };

/** id → def complète (torse 3 vues + jambe). */
export const BODIES: Record<string, BodyDef> = Object.fromEntries(BODY_DEFS.map((b) => [b.id, b]));
