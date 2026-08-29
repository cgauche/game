/**
 * Schéma de `symptoms.json` — dérivé de l'inventaire COMPLET des clés (script node, n=16/16) et de
 * `SymptomData`/`SymptomCapabilities` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'symptoms.json';
export const famille = 'entite';

const difficultySchemaLocal = z.enum([
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe',
  'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
]);

/** `SymptomCapabilities` (`src/data/index.ts`) — sac de flags CLOS. */
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

const doc = document(
  'symptoms',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    severePassive: z.array(gameOpSchema).optional(),
    /** Effets DÉCLENCHÉS du symptôme (Crampes abdominales `onOwnTestFailed`, MSRC 16) — MÊME schéma que
     *  Traits/Atouts (`triggeredEffectSchema`) ; source du dispatcher via `effectSourcesOf`. */
    effects: z.array(triggeredEffectSchema).optional(),
    onTick: z.strictObject({
      /** ABSENTE = conséquence INCONDITIONNELLE (Vers du Reik éclatement, MSRC 16 l.142 — pas de jet). */
      difficulty: difficultySchemaLocal.optional(),
      /** Toxine (LDB 20 l.215) : Modéré→Facile, Grave→Accessible — lu par `symptomOnTick`. */
      difficultyBySeverity: z.strictObject({
        moderee: difficultySchemaLocal.optional(),
        grave: difficultySchemaLocal.optional(),
      }).optional(),
      onFail: z.array(gameOpSchema),
      /** Ne démarre qu'au Nᵉ jour de PHASE ACTIVE (Vers de carie J+7, Vers du Reik 7ᵉ jour — MSRC 16). */
      afterDays: z.number().optional(),
      /** UNE seule fois (au jour `afterDays` exact — Vers du Reik) ; absent = quotidien (Vers de carie). */
      once: z.boolean().optional(),
    }).optional(),
    /** Passifs gatés sur la VISIBILITÉ de la lésion (Vers du Reik −10 Soc, MSRC 16 l.140). */
    visiblePassive: z.array(gameOpSchema).optional(),
    /** Localisations VISIBLES (`maison`) qui activent `visiblePassive`. */
    visibleLocations: z.array(hitLocationSchema).optional(),
    capabilities: symptomCapabilitiesSchema.optional(),
  },
  {
    passive: { label: 'Effets passifs' },
    severePassive: { label: 'Effets passifs (Grave)', hint: 'Effets passifs actifs seulement au palier de sévérité Grave' },
    effects: { label: 'Effets déclenchés' },
    onTick: {
      label: 'Évolution périodique',
      hint: 'Conséquence récurrente : chaque jour, ou au Nᵉ jour, avec ou sans jet ; l’échec applique ses effets',
    },
    visiblePassive: {
      label: 'Effets passifs (lésion visible)',
      hint: 'Actifs seulement quand la lésion est sur une localisation visible',
    },
    visibleLocations: { label: 'Localisations visibles' },
    capabilities: { label: 'Capacités mécaniques (liste fermée)' },
  },
  {
    codex: { keys: ['symptoms'] },
    edit: { dataset: 'symptoms' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
