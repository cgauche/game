/**
 * Schéma de `classes.json` — dérivé du contenu RÉEL (9 entrées) et de `ClassData`
 * (`src/data/index.ts:159`). `trappings` = `TrappingRef[]` (id catalogue + quantité, ou texte
 * flavor hors catalogue) — MÊME forme que `careerLevels.trappings`/`species`, PROMUE dans `common.ts`.
 */
import { z } from 'zod';
import { sourceRefSchema, trappingRefSchema } from '../common';

export const file = 'classes.json';

export const schema = z.array(
  z.strictObject({
    /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
    id: z.string(),
    label: z.string(),
    /** Possessions de départ. */
    trappings: z.array(trappingRefSchema),
    desc: z.string(),
    source: sourceRefSchema,
  }),
);

export type ClassesData = z.infer<typeof schema>;
