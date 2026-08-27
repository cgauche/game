/**
 * Schéma de `stars.json` — Étoiles (ADE II 3), dérivé du contenu RÉEL (23 étoiles) et de
 * `StarData` (`src/data/index.ts`). Les champs `string | null` de l'interface (signe/classique/
 * ascendant/dates/dieux/apparence) sont TOUS des `string` dans la donnée actuelle — nullable
 * conservé pour rester fidèle au contrat consommateur (le type autorise `null`). `desc` sort de ce
 * lot : la prose s'aligne sur l'enveloppe (`grammaire/document.ts`), absente plutôt que nulle.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'stars.json';
export const famille = 'entite';

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
    /** Effet du signe aux ATTRIBUTS DE DÉPART (ADE II 3 l.38) — `GameOp[]`, jamais de la prose : la
     *  clé porte le nom du CONCEPT qu'elle contient (`ops`, comme `drunkenness`/`traumas`/les
     *  Critiques), et la langue unique `applyOps`/`GameOpEditor` la lit sans exception d'atelier. */
    ops: z.array(gameOpSchema).optional(),
    /** Étoile du Sorcier (ADE II 3 l.63) : fourchette 1d10 interne `[min, max]` — tuple STRICT (2 éléments,
     *  observé `[1,3]` sur les variantes `rand:100`). */
    sub: z.tuple([z.number(), z.number()]).optional(),
    desc: z.string().min(1).optional(),
    source: sourceRefSchema,
  }),
);
