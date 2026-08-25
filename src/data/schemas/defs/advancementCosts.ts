/**
 * Schéma de `advancementCosts.json` — Tableau de Coût des Augmentations (LDB 07 l.51-70),
 * consommé par `src/engine/advancement.ts` (`AdvanceCostBand[]`, qui ignore `id`/`label`). Une bande =
 * nombre d'Augmentations DÉJÀ achetées, `max` borne haute INCLUSIVE ; la DERNIÈRE bande porte `max: null`
 * (« et au-delà », JSON n'a pas d'Infinity — cf. commentaire du consommateur). `id`/`label` = identité
 * STABLE de la bande (fourchette d'Augmentations déjà achetées), ajoutée pour l'exposition Codex (#422).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'advancementCosts.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    max: z.number().nullable(),
    char: z.number(),
    skill: z.number(),
    source: sourceRefSchema.optional(),
  }),
);
