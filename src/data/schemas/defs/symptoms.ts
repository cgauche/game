/**
 * Schéma de `symptoms.json` — dérivé de l'inventaire COMPLET des clés (script node, n=16/16) et de
 * `SymptomData`/`SymptomCapabilities` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { flowSchema, gameOpSchema, noeudTest, triggeredEffectSchema } from '../grammaire/mecanique';

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

/** Le JET du cycle et sa CONSÉQUENCE : le nœud `test` du Flow, difficulté REQUISE (LDB 20 l.212). */
const noeudDuCycle = noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true });

/**
 * Cycle de PHASE ACTIVE d'un symptôme. Le porteur dit QUAND (`afterDays`/`once`, ordonnancement) et
 * CE QUE la sévérité de l'instance change (`difficultyBySeverity`) ; le JET et sa conséquence vivent
 * dans le nœud `test`. Un cycle SANS jet (MSRC 16 l.142) n'est pas une épreuve : il porte `ops`, la
 * liste de `GameOp` CERTAINS — même graphie que `passive`/`severePassive`/`visiblePassive`.
 */
const onTickSchema = z
  .strictObject({
    test: noeudDuCycle.optional(),
    ops: z.array(gameOpSchema).optional(),
    /** Toxine (LDB 20 l.215) : Modéré→Facile, Grave→Accessible — lu par `symptomOnTick`. */
    difficultyBySeverity: z
      .strictObject({
        moderee: difficultySchemaLocal.optional(),
        grave: difficultySchemaLocal.optional(),
      })
      .optional(),
    /** Ne démarre qu'au Nᵉ jour de PHASE ACTIVE (Vers de carie J+7, Vers du Reik 7ᵉ jour — MSRC 16). */
    afterDays: z.number().optional(),
    /** UNE seule fois (au jour `afterDays` exact — Vers du Reik) ; absent = quotidien (Vers de carie). */
    once: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.test === !v.ops) {
      ctx.addIssue({
        code: 'custom',
        message: 'un cycle porte SOIT une épreuve (`test`) SOIT une conséquence certaine (`ops`) — jamais les deux, jamais aucune.',
      });
    }
    if (v.difficultyBySeverity && !v.test) {
      ctx.addIssue({
        code: 'custom',
        path: ['difficultyBySeverity'],
        message: '`difficultyBySeverity` indexe la Difficulté d’une épreuve — un cycle sans `test` n’en a aucune.',
      });
    }
  });

const doc = document(
  'symptoms',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    severePassive: z.array(gameOpSchema).optional(),
    /** Effets DÉCLENCHÉS du symptôme (Crampes abdominales `onOwnTestFailed`, MSRC 16) — MÊME schéma que
     *  Traits/Atouts (`triggeredEffectSchema`) ; source du dispatcher via `effectSourcesOf`. */
    effects: z.array(triggeredEffectSchema).optional(),
    onTick: onTickSchema.optional(),
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
      hint: 'Conséquence récurrente : chaque jour, ou au Nᵉ jour ; sous jet (nœud `test`, la branche d’échec applique ses effets) ou certaine (`ops`)',
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
