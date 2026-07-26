/**
 * Schéma de `spells.json` — dérivé de l'inventaire COMPLET des clés (script node, n=416/416), de
 * `SpellData` (`src/data/index.ts:983`), `SpellRange`/`SpellTarget` (`src/engine/spellRange.ts:15-27`),
 * `SpellDuration` (`src/engine/spellDuration.ts:13-18`) et `Formula` (`src/engine/ops.ts:65-84`).
 * `effects` (`Flow<EffectOp>`) : MÊME algèbre que talents/etats (`engine/flowCore.ts`), PROMUE dans
 * `common.ts` (`flowSchema`/`conditionSchema`/`formulaSchema`).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, charKeySchema, flowSchema, formulaSchema, variantOf } from '../common';

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
/** Entrée de `spells.json`. */
const spellEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Libellé d'affichage du type (« Béni », « Magie mineure »… 17 valeurs constatées, PROSE — le
   *  discriminant de logique est `family`). */
  type: z.string(),
  subType: z.string().nullable(),
  domainId: z.string().optional(),
  /** `VDM 02 l.363` / `l.377-393` — TAG lu par `castingNumberOf` (`src/engine/magic.ts:483`) et
   *  `effectiveSpellOf` (`src/state/combatFlow.ts:3739`) pour composer un `CastingNumberSubject`
   *  dont le `kind` départage les portées `kinds:['sort'|'rituel']` (`VDM 12 l.646-647`,
   *  `VDM 14 l.489`). Sans ce champ au schéma, aucune donnée ne peut porter la nature Rituel. */
  isRitual: z.boolean().optional(),
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
  /** Emplacement SECONDAIRE (#563) — ex. `maitre-de-la-bete` prose folio 246 (ancre) ET stat-bloc
   *  (NI/Portée/Cible/Durée) folio 245 (`alsoIn[0].quote`). */
  alsoIn: z.array(secondarySourceRefSchema).optional(),
});

/**
 * Champs qu'une variante réglée de `spells.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` (`src/engine/variants.ts`), preuve par consommateur :
 *  - `desc`/`source` → fiche Codex `src/ui/compendium/registry.ts:1371` (bâtie sur `effectiveEntry`,
 *    `registry.ts:1370`)
 *  - `cn` → NI effectif `castingNumberOf` (`src/engine/magic.ts:486`), lu par `evaluateCasting`
 *    (`magic.ts:596`) et `castLandProbability` (`magic.ts:561`) ; aperçu pré-jet `previewCast`
 *    (`src/state/combatFlow.ts:844`) ; NI de lecture au grimoire `effectiveSpellOf`
 *    (`src/state/combatFlow.ts:3740`) ; « NI » affiché de la fiche Codex (`registry.ts:1373`)
 *  - `duration` → `durationClockMinutes` (`src/state/combatFlow.ts:4105`), durée de la zone posée
 *    par `placeSpellZone` (`src/state/combatFlow.ts:4304`)
 *  - `effects` → `spellFlowFor` (`src/state/combatFlow.ts:4122`), `spellOps`
 *    (`src/state/combatEffects.ts:1463`)
 * `range`/`target`/`missile`/`damage`/`ignorePA`/`ignoreBE`/`opposed` en sont ABSENTS : aucune
 * variante curée ne les republie, et une liste blanche n'admet un champ qu'au moment où une donnée
 * réelle l'exerce.
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source', 'cn', 'duration', 'effects'] as const;

export const schema = z.array(
  spellEntrySchema.extend({
    /** Variantes réglées (#563/#564) : patch PARTIEL de l'entrée sur `VARIANT_RESOLVED_FIELDS`,
     *  résolu par `effectiveEntry` (`engine/variants.ts`, REPLACE par champ déclaré) — SEULE lecture
     *  des consommateurs. Les 18 sorts que VDM révise sont gatés par `magic-vdm-incantation`. */
    variants: z.array(variantOf(spellEntrySchema, VARIANT_RESOLVED_FIELDS)).optional(),
  }),
);

export type SpellsData = z.infer<typeof schema>;
