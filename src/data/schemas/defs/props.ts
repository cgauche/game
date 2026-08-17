/**
 * Schéma de `props.json` — accessoires de scène (rendu iso : solidité/opacité/couvert/lumière).
 * Dérivé de l'interface `PropData` EXISTANTE (`src/data/index.ts:1360`, déjà typée par le seul
 * consommateur) et du contenu RÉEL (59 entrées, script d'inventaire : `id` seul obligatoire, `solid`
 * 57/59, `cover` 12/59 ∈ {imparfaite,moyenne,totale}, `light.radiusTiles` 4/59, `opaque` 1/59).
 */
import { z } from 'zod';

export const file = 'props.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    solid: z.boolean().optional(),
    opaque: z.boolean().optional(),
    cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    // `tone` (#1245, L4) = APPARENCE seule (`lightTones.json` : couleur/intensité/vacillement),
    // résolue au bord du rendu ; le RAYON reste la seule chose que le moteur lise d'une source.
    light: z.strictObject({ radiusTiles: z.number(), tone: z.string().optional() }).optional(),
  }),
);
