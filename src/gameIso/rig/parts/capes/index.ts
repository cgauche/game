/**
 * Registre des CAPES, dérivé des `defs/` (1 cape = 1 fichier). Source unique de l'art de cape, servi
 * en DORSAL (dorsalOverlays) pour l'emplacement Cape (equip.cape). Référencé par id.
 */
import { CAPE_DEFS, type CapeId } from './_registry.generated';

export type { CapeId };
export type { CapeDef } from './types';

export interface CapeViews { front: string; back: string; profile: string }

/** id → jeu de 3 vues (à passer tel quel à dorsalOverlays). */
export const CAPES: Record<string, CapeViews> = Object.fromEntries(
  CAPE_DEFS.map((c) => [c.id, { front: c.front, back: c.back, profile: c.profile }]),
);
