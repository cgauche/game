/**
 * Schéma de `maladies.json` — Maladies et infections (LDB 20). Dérivé du contenu RÉEL (16 maladies)
 * et de son consommateur typé `DiseaseDef` (`src/engine/disease.ts`, `DiseaseTime`/`DiceSpec` id.).
 * `source` : ABSENT de `DiseaseDef` (le moteur ne le lit pas) et seulement 5/16 entrées le portent
 * (les maladies hors-LDB — Mort sur le Reik Compagnon, EDO, Middenheim) ; l'enveloppe la laisse
 * optionnelle, le refine de provenance de la fabrique exigeant `source` OU `maison`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';
import { idDe } from '../grammaire/ref';

export const file = 'maladies.json';
export const famille = 'entite';

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

const doc = document(
  'maladies',
  famille,
  {
    contractDifficulty: z.string(),
    incubation: diseaseTimeSchema,
    duration: diseaseTimeSchema,
    symptoms: z.array(diseaseSymptomSchema),
    /** Vérole Urticante (LDB 20 l.127-129) : immunité après guérison — absent ailleurs. */
    immuneAfterCure: z.boolean().optional(),
    /** Passifs actifs pendant toute l'INFECTION (Vers du Reik −5 Résistance/30 j, MSRC 16 l.138). */
    infectionPassive: z.array(gameOpSchema).optional(),
    /** `DiseaseDef.contaminatesWaterBarrel` (`src/engine/disease.ts`) — MDG 14 l.209. */
    contaminatesWaterBarrel: z.boolean().optional(),
    /** Test de cycle quotidien de la MALADIE (Pneumonie — EDOC 08 l.104-108). */
    dailyTest: z.strictObject({ difficulty: z.string(), symptomId: z.string(), onFail: z.array(gameOpSchema) }).optional(),
    /** MUE en une autre maladie après N jours de phase active (Rhume commun — EDOC 08 l.122). */
    mutation: z.strictObject({ afterDays: z.number(), into: idDe('maladie') }).optional(),
    /** RÉ-EXPOSITION à la cause de contraction alors que la maladie est déjà portée (Rhume commun —
     *  EDOC 08 l.122) : `prolonge` est un temps authoré, MÊME graphie que `incubation`/`duration`. */
    reExposition: z.strictObject({ prolonge: diseaseTimeSchema }).optional(),
  },
  {
    contractDifficulty: { label: 'Difficulté de contraction' },
    incubation: { label: 'Incubation', hint: 'Délai avant apparition des symptômes' },
    duration: { label: 'Durée', hint: 'Durée de la maladie' },
    symptoms: { label: 'Symptômes' },
    immuneAfterCure: { label: 'Immunise après guérison' },
    infectionPassive: { label: 'Effets passifs (infection)', hint: 'Effets actifs en continu tant que l’infection dure' },
    contaminatesWaterBarrel: { label: 'Contamine un baril d’eau' },
    dailyTest: { label: 'Test quotidien', hint: 'Test de Résistance porté par la maladie elle-même, roulé à chaque jour d’entretien (écart à EDOC 08 l.104, #674)' },
    mutation: { label: 'Mue', hint: 'Au-delà de N jours de symptômes actifs, la maladie se transforme en une autre' },
    reExposition: { label: 'Ré-exposition', hint: 'Ré-exposé à la cause de contraction alors qu’il la porte déjà : la durée se prolonge (EDOC 08 l.122)' },
  },
  {
    codex: { keys: ['maladies'] },
    edit: { dataset: 'maladies' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
