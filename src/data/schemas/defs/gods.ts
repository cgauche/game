/**
 * Schéma de `gods.json` — dérivé du contenu RÉEL (41 entrées, script d'inventaire) et de
 * `GodData` (`src/data/index.ts:1414`). `blessings`/`miracles`/`chaosSpells` = `Ref[]` (par id de
 * sort) — même petite forme que `TrappingRef`/`AdvancementRef`, PROMUE dans `common.ts`.
 */
import { z } from 'zod';
import { sourceRefSchema, refSchema } from '../common';

export const file = 'gods.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    title: z.string().optional(),
    blessings: z.array(refSchema),
    miracles: z.array(refSchema),
    /** Sorts du Chaos accordés (LDB 10 « Magie du Chaos »/Domaine du Chaos) — 3/41 dieux (Nurgle/
     *  Slaanesh/Tzeentch). */
    chaosSpells: z.array(refSchema).optional(),
    desc: z.string().optional(),
    source: sourceRefSchema.optional(),
    /** VERROU de Péché (MDG 11 l.142, Stromfels) : seuil de Points de Péché retirant l'usage du
     *  Talent de Prière (Béni/Invocation). 1/41 dieu observé (Stromfels). */
    sinLocks: z.strictObject({ beni: z.number().optional(), invocation: z.number().optional() }).optional(),
  }),
);
