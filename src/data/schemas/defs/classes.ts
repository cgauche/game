/**
 * Schéma de `classes.json` — dérivé du contenu RÉEL (9 entrées) et de `ClassData`
 * (`src/data/index.ts`). `trappings` = `TrappingRef[]` (id catalogue + quantité, ou texte
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
    /** Ids de `groups.json` accordés à tout titulaire d'une carrière de cette Classe (`groupsFor`).
     *  Absent = la Classe n'ouvre aucun Groupe d'appartenance. */
    grantGroups: z.array(z.string()).optional(),
    /** Possessions de départ. */
    trappings: z.array(trappingRefSchema),
    desc: z.string(),
    source: sourceRefSchema,
  }),
);
