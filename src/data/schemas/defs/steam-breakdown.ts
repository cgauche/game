/**
 * Schéma de `steam-breakdown.json` — Panne de Vapeur (MDG 12 l.313-352), `SteamBreakdownEntry`
 * (`src/engine/shipBuild.ts`), tirée par `rollSteamBreakdown` (d100).
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'steam-breakdown.json';

export const schema = z.array(
  z.strictObject({
    min: z.number(),
    max: z.number(),
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    mMod: z.number().optional(),
    durationRounds: z.string().optional(),
    failDamage: z.string().optional(),
    engineDestroyed: z.boolean().optional(),
    hullCritical: z.boolean().optional(),
    compartmentDamage: z.number().optional(),
    mSet: z.number().optional(),
    coolMinutes: z.string().optional(),
    restart: z
      .array(
        z.strictObject({
          skillId: z.string(),
          spec: z.string().optional(),
          difficulty: difficultySchema,
          extendedDR: z.number().optional(),
        }),
      )
      .optional(),
    source: sourceRefSchema.optional(),
  }),
);
