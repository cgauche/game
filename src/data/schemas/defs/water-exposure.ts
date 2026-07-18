/**
 * Schéma de `water-exposure.json` — Exposition hydrique (MSRC 16 p.91). Fichier NON-tableau (objet
 * unique), dérivé de `WaterExposureData`/`WaterExposureModifier`/`WaterExposureAuto`
 * (`src/data/index.ts:105-126`). `test.difficulty` = `Difficulty` (moteur) → `difficultySchema` partagé.
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../common';

export const file = 'water-exposure.json';

/** Union PLATE (pas `discriminatedUnion` — `woundsLost` a 2 formes selon `op`, discriminant non-unique
 *  sur `kind` seul). */
const waterExposureAutoSchema = z.union([
  z.strictObject({ kind: z.literal('woundsRemaining'), op: z.literal('<='), value: z.number() }),
  z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('>='), value: z.number() }),
  z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('between'), min: z.number(), max: z.number() }),
  z.strictObject({ kind: z.literal('perCondition'), condition: z.string() }),
  z.strictObject({ kind: z.literal('hasCondition'), condition: z.string() }),
]);

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  test: z.strictObject({
    skillId: z.string(),
    difficulty: difficultySchema,
  }),
  rollModPerNegativeSL: z.number(),
  modifiers: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      mod: z.number(),
      appliesTo: z.array(z.enum(['ingestion', 'immersion'])),
      table: z.enum(['source-d-eau', 'blessures-et-etats']),
      auto: waterExposureAutoSchema.optional(),
    }),
  ),
  diseases: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      disease: z.string(),
      rerollUnlessWounded: z.boolean().optional(),
    }),
  ),
  source: sourceRefSchema,
});

export type WaterExposureData = z.infer<typeof schema>;
