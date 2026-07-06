/**
 * Schéma de `maladies.json` — Maladies et infections (LDB 20). Dérivé du contenu RÉEL (16 maladies)
 * et de son consommateur typé `DiseaseDef` (`src/engine/disease.ts:74`, `DiseaseTime`/`DiceSpec` id.).
 * `source` : ABSENT de `DiseaseDef` (le moteur ne le lit pas) et seulement 5/16 entrées le portent
 * (les maladies hors-LDB — Mort sur le Reik Compagnon, EDO, Middenheim) → optionnel, fidèle aux DEUX.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'maladies.json';

const diceSpecSchema = z.strictObject({
  n: z.number(),
  sides: z.number(),
  plus: z.number().optional(),
});

const diseaseTimeSchema = z.strictObject({
  dice: diceSpecSchema,
  unit: z.enum(['days', 'hours', 'minutes']),
});

const diseaseSymptomSchema = z.strictObject({
  symptomId: z.string(),
  severity: z.enum(['moderee', 'grave']).optional(),
  difficulty: z.string().optional(),
  spec: z.string().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    contractDifficulty: z.string(),
    incubation: diseaseTimeSchema,
    duration: diseaseTimeSchema,
    symptoms: z.array(diseaseSymptomSchema),
    /** Vérole Urticante (LDB 20 l.97) : immunité après guérison — absent ailleurs. */
    immuneAfterCure: z.boolean().optional(),
    source: sourceRefSchema.optional(),
  }),
);

export type MaladiesData = z.infer<typeof schema>;
