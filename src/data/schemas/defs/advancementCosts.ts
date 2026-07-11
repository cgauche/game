/**
 * Schéma de `advancementCosts.json` — Tableau de Coût des Augmentations (LDB 07-Carrières l.45-62),
 * consommé par `src/engine/advancement.ts:32` (`AdvanceCostBand[]`). Une bande = nombre d'Augmentations
 * DÉJÀ achetées, `max` borne haute INCLUSIVE ; la DERNIÈRE bande porte `max: null` (« et au-delà »,
 * JSON n'a pas d'Infinity — cf. commentaire du consommateur).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'advancementCosts.json';

export const schema = z.array(
  z.strictObject({
    max: z.number().nullable(),
    char: z.number(),
    skill: z.number(),
    source: sourceRefSchema.optional(),
  }),
);

export type AdvancementCostsData = z.infer<typeof schema>;
