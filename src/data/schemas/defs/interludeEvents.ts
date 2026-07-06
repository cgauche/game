/**
 * Schéma de `interludeEvents.json` — Tableau des Événements « Entre deux aventures » (LDB `22 -
 * Événements.md`, d100), miroir strict de `InterludeEvent`/`InterludeEventFx`
 * (`src/data/interludeEvents.ts:14-38`).
 */
import { z } from 'zod';

export const file = 'interludeEvents.json';

const fxSchema = z.strictObject({
  moneyPct: z.number().optional(),
  revenuePct: z.number().optional(),
  revenueClasses: z.array(z.string()).optional(),
  revenueBlockedClasses: z.array(z.string()).optional(),
  bankPct: z.number().optional(),
  fortuneMaxDelta: z.number().optional(),
  loseActivity: z.boolean().optional(),
  stashRaided: z.boolean().optional(),
  bankCrashCheck: z.boolean().optional(),
});

export const schema = z.array(
  z.strictObject({
    min: z.number(),
    max: z.number(),
    label: z.string(),
    /** Résumé fidèle du texte (verbatim abrégé). */
    text: z.string(),
    fx: fxSchema.optional(),
  }),
);

export type InterludeEventsData = z.infer<typeof schema>;
