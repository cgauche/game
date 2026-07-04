/**
 * Registre des AILES, dérivé des `defs/` (1 paire = 1 fichier). Source unique de l'art d'ailes, servi
 * en DORSAL (dorsalOverlays) par le trait Vol, l'élément 'ailes' et monster.ailes. Référencé par id.
 */
import { WING_DEFS, type WingId } from './_registry.generated';

export type { WingId };
export type { WingDef } from './types';

export interface WingViews { front: string; back: string; profile: string }

/** id → jeu de 3 vues (à passer tel quel à dorsalOverlays). */
export const WINGS: Record<string, WingViews> = Object.fromEntries(
  WING_DEFS.map((w) => [w.id, { front: w.front, back: w.back, profile: w.profile }]),
);
