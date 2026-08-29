/**
 * Schéma de `stars.json` — Étoiles (ADE II 3), dérivé du contenu RÉEL (23 étoiles) et de
 * `StarData` (`src/data/index.ts`). Les champs `string | null` de l'interface (signe/classique/
 * ascendant/dates/dieux/apparence) sont TOUS des `string` dans la donnée actuelle — nullable
 * conservé pour rester fidèle au contrat consommateur (le type autorise `null`). `desc` et `source`
 * sont des clés d'ENVELOPPE, `source` EXIGÉE (`options.exiges`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'stars.json';
export const famille = 'entite';

const doc = document(
  'stars',
  famille,
  {
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
  },
  {
    rand: { label: 'Seuil aléatoire (d100)' },
    signe: { label: 'Signe' },
    classique: { label: 'Nom classique' },
    ascendant: { label: 'Ascendant' },
    dates: { label: 'Dates' },
    dieux: { label: 'Dieux associés' },
    apparence: { label: 'Apparence' },
    ops: {
      label: 'Effets accordés',
      hint: 'Ajustement de Caractéristique / Talent octroyé, appliqué une fois à la création',
    },
    sub: { label: 'Sous-tirage', hint: 'Fourchette 1d10 interne (Étoile du Sorcier)' },
  },
  {
    codex: { keys: ['stars'] },
    edit: { dataset: 'stars' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
