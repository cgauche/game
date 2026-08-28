/**
 * Schéma de `water-exposure.json` — Exposition hydrique (MSRC 16 p.91). Fichier NON-tableau (objet
 * unique), dérivé de `WaterExposureData`/`WaterExposureModifier`/`WaterExposureAuto`
 * (`src/data/index.ts`). `test.difficulty` = `Difficulty` (moteur) → `difficultySchema` partagé.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema } from '../grammaire/valeurs';

export const file = 'water-exposure.json';
export const famille = 'config';

/** Union PLATE (pas `discriminatedUnion` — `woundsLost` a 2 formes selon `op`, discriminant non-unique
 *  sur `kind` seul). */
const waterExposureAutoSchema = z.union([
  z.strictObject({ kind: z.literal('woundsRemaining'), op: z.literal('<='), value: z.number() }),
  z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('>='), value: z.number() }),
  z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('between'), min: z.number(), max: z.number() }),
  z.strictObject({ kind: z.literal('perCondition'), condition: z.string() }),
  z.strictObject({ kind: z.literal('hasCondition'), condition: z.string() }),
]);

const doc = document(
  'water-exposure',
  famille,
  {
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
  },
  {
    test: { label: "Test d'exposition", hint: "Compétence et difficulté du Test déclenché par l'exposition à l'eau" },
    rollModPerNegativeSL: {
      label: 'Malus par DR négatif (jet de maladie)',
      hint: "Modificateur ajouté au tirage de la maladie (d100), +10 par DR négatif du Test d'exposition",
    },
    modifiers: {
      label: 'Modificateurs',
      hint: "Modificateurs de Test par source d'eau/état, appliqués à l'ingestion et/ou l'immersion",
    },
    diseases: { label: 'Maladies contractées', hint: "Table de tirage d100 de la maladie contractée en cas d'échec" },
  },
  { codex: { keys: ['waterExposure'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
