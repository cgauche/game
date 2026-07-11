/**
 * Schéma de `symptoms.json` — dérivé de l'inventaire COMPLET des clés (script node, n=16/16) et de
 * `SymptomData`/`SymptomCapabilities` (`src/data/index.ts:904` et `:917`).
 */
import { z } from 'zod';
import { sourceRefSchema, gameOpSchema } from '../common';

export const file = 'symptoms.json';

const difficultySchemaLocal = z.enum([
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe',
  'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
]);

/** `SymptomCapabilities` (`src/data/index.ts:904`) — sac de flags CLOS. */
const symptomCapabilitiesSchema = z.strictObject({
  blocksHealing: z.boolean().optional(),
  amputation: z.boolean().optional(),
  stickyExtenue: z.boolean().optional(),
  contagious: z.boolean().optional(),
  nausea: z.boolean().optional(),
  endTest: z.boolean().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    /** `source` optionnel dans `SymptomData` (≠ la plupart des autres datasets où il est requis) —
     *  reflet exact de l'interface TS (`source?: { book, page }`). */
    source: sourceRefSchema.optional(),
    passive: z.array(gameOpSchema).optional(),
    severePassive: z.array(gameOpSchema).optional(),
    onTick: z.strictObject({
      difficulty: difficultySchemaLocal,
      /** Toxine (LDB 20 l.215) : Modéré→Facile, Grave→Accessible — lu par `symptomOnTick`. */
      difficultyBySeverity: z.strictObject({
        moderee: difficultySchemaLocal.optional(),
        grave: difficultySchemaLocal.optional(),
      }).optional(),
      onFail: z.array(gameOpSchema),
    }).optional(),
    capabilities: symptomCapabilitiesSchema.optional(),
  }),
);

export type SymptomsData = z.infer<typeof schema>;
