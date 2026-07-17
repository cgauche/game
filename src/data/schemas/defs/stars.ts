/**
 * Schéma de `stars.json` — Étoiles (ADE2 3), dérivé du contenu RÉEL (23 étoiles) et de
 * `StarData` (`src/data/index.ts:1051`). Les champs `string | null` de l'interface (signe/classique/
 * ascendant/dates/dieux/apparence/desc) sont TOUS des `string` dans la donnée actuelle — nullable
 * conservé pour rester fidèle au contrat consommateur (le type autorise `null`).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema } from '../common';

export const file = 'stars.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    rand: z.number(),
    signe: z.string().nullable(),
    classique: z.string().nullable(),
    ascendant: z.string().nullable(),
    dates: z.string().nullable(),
    dieux: z.string().nullable(),
    apparence: z.string().nullable(),
    effect: z.array(gameOpSchema).optional(),
    /** Étoile du Sorcier (ADE2 3 l.63) : fourchette 1d10 interne `[min, max]` — tuple STRICT (2 éléments,
     *  observé `[1,3]` sur les variantes `rand:100`). */
    sub: z.tuple([z.number(), z.number()]).optional(),
    desc: z.string().nullable(),
    source: sourceRefSchema,
  }),
);

export type StarsData = z.infer<typeof schema>;
