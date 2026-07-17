/**
 * Schéma de `spells.json` — dérivé de l'inventaire COMPLET des clés (script node, n=416/416), de
 * `SpellData` (`src/data/index.ts:983`), `SpellRange`/`SpellTarget` (`src/engine/spellRange.ts:15-27`),
 * `SpellDuration` (`src/engine/spellDuration.ts:13-18`) et `Formula` (`src/engine/ops.ts:65-84`).
 * `effects` (`Flow<EffectOp>`) : MÊME algèbre que talents/etats (`engine/flowCore.ts`), PROMUE dans
 * `common.ts` (`flowSchema`/`conditionSchema`/`formulaSchema`).
 */
import { z } from 'zod';
import { sourceRefSchema, charKeySchema, flowSchema, formulaSchema } from '../common';

export const file = 'spells.json';

/** `SpellRange` (`engine/spellRange.ts:15`). */
const spellRangeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('touch') }),
  z.strictObject({ kind: z.literal('distance'), value: formulaSchema, unit: z.enum(['m', 'km']) }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellTarget` (`engine/spellRange.ts:22`). */
const spellTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('count'), n: formulaSchema }),
  z.strictObject({ kind: z.literal('area'), span: z.enum(['radius', 'diameter']), meters: formulaSchema, excludesCaster: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('cone'), lengthMeters: formulaSchema, widthMeters: formulaSchema }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellDuration` (`engine/spellDuration.ts:13`). */
const spellDurationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('instant') }),
  z.strictObject({ kind: z.literal('rounds'), value: formulaSchema, plus: z.literal(true).optional() }),
  z.strictObject({ kind: z.literal('clock'), value: formulaSchema, unit: z.enum(['minutes', 'hours', 'days']) }),
  z.strictObject({ kind: z.literal('untilDawn') }),
  z.strictObject({ kind: z.literal('special'), text: z.string(), plus: z.literal(true).optional() }),
]);

// ── SpellData (src/data/index.ts:983) ───────────────────────────────────────────────────────────
export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** Libellé d'affichage du type (« Béni », « Magie mineure »… 17 valeurs constatées, PROSE — le
     *  discriminant de logique est `family`). */
    type: z.string(),
    subType: z.string().nullable(),
    domainId: z.string().optional(),
    isPrayer: z.boolean().optional(),
    family: z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']),
    cn: z.number().nullable(),
    range: spellRangeSchema.nullable(),
    target: spellTargetSchema.nullable(),
    duration: spellDurationSchema.nullable(),
    desc: z.string(),
    missile: z.boolean().optional(),
    damage: z.number().optional(),
    ignorePA: z.boolean().optional(),
    ignoreBE: z.boolean().optional(),
    curated: z.boolean().optional(),
    breathAttack: z.literal(true).optional(),
    opposed: z.strictObject({
      kind: z.enum(['resist', 'contact']),
      char: charKeySchema.optional(),
      skill: z.string().optional(),
    }).optional(),
    effects: flowSchema.optional(),
    source: sourceRefSchema,
  }),
);

export type SpellsData = z.infer<typeof schema>;
