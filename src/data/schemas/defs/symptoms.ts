/**
 * Schéma de `symptoms.json` — dérivé de l'inventaire COMPLET des clés (script node, n=16/16) et de
 * `SymptomData`/`SymptomCapabilities` (`src/data/index.ts:904` et `:917`).
 */
import { z } from 'zod';
import { sourceRefSchema, gameOpSchema, triggeredEffectSchema } from '../common';

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
  persistentActive: z.boolean().optional(),
});

const hitLocationSchema = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);

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
    /** Effets DÉCLENCHÉS du symptôme (Crampes abdominales `onOwnTestFailed`, T2C 16) — MÊME schéma que
     *  Traits/Atouts (`triggeredEffectSchema`) ; source du dispatcher via `effectSourcesOf`. */
    effects: z.array(triggeredEffectSchema).optional(),
    onTick: z.strictObject({
      /** ABSENTE = conséquence INCONDITIONNELLE (Vers du Reik éclatement, T2C 16 l.142 — pas de jet). */
      difficulty: difficultySchemaLocal.optional(),
      /** Toxine (LDB 20 l.215) : Modéré→Facile, Grave→Accessible — lu par `symptomOnTick`. */
      difficultyBySeverity: z.strictObject({
        moderee: difficultySchemaLocal.optional(),
        grave: difficultySchemaLocal.optional(),
      }).optional(),
      onFail: z.array(gameOpSchema),
      /** Ne démarre qu'au Nᵉ jour de PHASE ACTIVE (Vers de carie J+7, Vers du Reik 7ᵉ jour — T2C 16). */
      afterDays: z.number().optional(),
      /** UNE seule fois (au jour `afterDays` exact — Vers du Reik) ; absent = quotidien (Vers de carie). */
      once: z.boolean().optional(),
    }).optional(),
    /** Passifs gatés sur la VISIBILITÉ de la lésion (Vers du Reik −10 Soc, T2C 16 l.140). */
    visiblePassive: z.array(gameOpSchema).optional(),
    /** Localisations VISIBLES (`maison`) qui activent `visiblePassive`. */
    visibleLocations: z.array(hitLocationSchema).optional(),
    capabilities: symptomCapabilitiesSchema.optional(),
  }),
);

export type SymptomsData = z.infer<typeof schema>;
