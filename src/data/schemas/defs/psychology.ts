/**
 * Schéma de `psychology.json` — États PSYCHOLOGIQUES (LDB 21), miroir de `PsychologyData extends
 * StatusData` (`src/data/index.ts:556-573` + `605-650`). Inventaire réel (9 entrées) : `gating` (hérité
 * de `StatusData`) n'est utilisé par AUCUNE entrée aujourd'hui — modélisé quand même (reflet de
 * l'interface), simplement optionnel et jamais peuplé en pratique.
 */
import { z } from 'zod';
import { sourceRefSchema, gameOpSchema, difficultySchema, triggeredEffectSchema } from '../common';

export const file = 'psychology.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    source: sourceRefSchema,
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: z
      .strictObject({
        action: z.literal('none').optional(),
        movement: z.enum(['none', 'half', 'crawl']).optional(),
        cannotDefend: z.literal(true).optional(),
      })
      .optional(),
    icon: z.string().optional(),
    psychImmune: z.boolean().optional(),
    targeted: z.boolean().optional(),
    endedByOtherPsych: z.boolean().optional(),
    immuneToFromTarget: z.array(z.string()).optional(),
    attackDR: z.strictObject({ amount: z.number(), vs: z.enum(['source', 'group', 'any']) }).optional(),
    cancelsFear: z.boolean().optional(),
    resolution: z.enum(['extended', 'terreur', 'binary']).optional(),
    failCondition: z.string().optional(),
    failAmount: z
      .strictObject({
        base: z.union([z.literal('indice'), z.number()]).optional(),
        perDegreeOfFailure: z.number().optional(),
      })
      .optional(),
    becomes: z.string().optional(),
    test: z.strictObject({ skill: z.string().optional(), difficulty: difficultySchema.optional() }).optional(),
  }),
);

export type PsychologyData = z.infer<typeof schema>;
