/**
 * Schéma de `talents.json` — dérivé de l'inventaire COMPLET des clés (script node, n=179/179), de
 * l'interface `TalentData` (`src/data/index.ts:311`), `TalentTest`/`TestMatch` (l.288-310) et
 * `CombatFeature` (`src/engine/combatFeatures/types.ts`). `effects` (`TriggeredEffect[]`) et son
 * `Flow` récursif (`src/engine/flowCore.ts`) sont PROMUS dans `common.ts` (`conditionSchema`/
 * `flowSchema`/`triggeredEffectSchema` — ex-dupliqués à l'identique dans talents/etats/spells).
 */
import { z } from 'zod';
import { charKeySchema, sourceRefSchema, gameOpSchema, conditionSchema, triggeredEffectSchema } from '../common';

export const file = 'talents.json';

const specsSourceSchema = z.enum([
  'weaponGroupsMelee', 'weaponGroupsRanged', 'winds', 'arcaneDomains', 'cultBlessings',
  'cultMiracles', 'cultChaos', 'seaShanties', 'groups', 'diseases', 'sizes', 'mutations',
  'breathTypes', 'damageTypes', 'weaponsMelee', 'weaponsRanged',
]);
const specEntrySchema = z.strictObject({ id: z.string(), label: z.string() });

// ── TestMatch / TalentTest (src/data/index.ts:288-310) ──────────────────────────────────────────
const testMatchSchema = z.strictObject({
  skill: z.string().optional(),
  char: charKeySchema.optional(),
  spec: z.string().optional(),
  specFromInstance: z.boolean().optional(),
  exceptSpec: z.string().optional(),
  when: conditionSchema.optional(),
  manual: z.boolean().optional(),
});

const talentTestSchema = z.strictObject({
  raw: z.string(),
  matches: z.array(testMatchSchema),
});

// ── CombatFeature (src/engine/combatFeatures/types.ts) — sac de flags CLOS, `aa` récursif ──────────
const castingKindSchema = z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']);
const combatFeatureSchema: z.ZodType<unknown> = z.lazy(() =>
  z.strictObject({
    offHandPenalty: z.strictObject({ perLevel: z.number(), zeroAt: z.number() }).optional(),
    attackModes: z.array(z.string()).optional(),
    meleeDamageBonus: z.boolean().optional(),
    rangedDamageBonus: z.boolean().optional(),
    brawlDamageBonus: z.boolean().optional(),
    chargeDamageBonus: z.boolean().optional(),
    slayer: z.boolean().optional(),
    damageReduction: z.boolean().optional(),
    critExtraWounds: z.boolean().optional(),
    rangedAPIgnore: z.boolean().optional(),
    ignoreCalledShotHead: z.boolean().optional(),
    ignoreCalledShotRanged: z.boolean().optional(),
    ignoreSizeRangedMods: z.boolean().optional(),
    sniper: z.boolean().optional(),
    initiativeBonus: z.boolean().optional(),
    strikeFirstRanged: z.boolean().optional(),
    surpriseSave: z.boolean().optional(),
    reloadDR: z.enum(['all', 'blackpowder']).optional(),
    runBonus: z.boolean().optional(),
    fleeBonus: z.boolean().optional(),
    shieldAdvantage: z.boolean().optional(),
    counterOnDefenseWin: z.boolean().optional(),
    counterRequiresFastParry: z.boolean().optional(),
    stealAdvantage: z.boolean().optional(),
    stealOne: z.boolean().optional(),
    transferWeight: z.number().optional(),
    reloadAssessAdvantage: z.boolean().optional(),
    fearSizeAsMount: z.boolean().optional(),
    retreatCost: z.number().optional(),
    keepAdvantageOnDisengage: z.boolean().optional(),
    disengageWithLessAdvantage: z.boolean().optional(),
    battement: z.boolean().optional(),
    distraire: z.boolean().optional(),
    outnumberCount: z.boolean().optional(),
    braveheart: z.boolean().optional(),
    fearImmune: z.boolean().optional(),
    bleedIgnore: z.boolean().optional(),
    magicResistance2: z.boolean().optional(),
    focusNoMiscastOnDouble: z.boolean().optional(),
    causesFear: z.boolean().optional(),
    reverseFailed: z.strictObject({ skill: z.string(), spec: z.string().optional(), capDR: z.number().optional() }).optional(),
    bargainBonus: z.boolean().optional(),
    encumbranceBonus: z.boolean().optional(),
    corruptionThreshold: z.boolean().optional(),
    surgery: z.boolean().optional(),
    castingKind: castingKindSchema.optional(),
    commandTeam: z.boolean().optional(),
    seaShanty: z.boolean().optional(),
    aa: combatFeatureSchema.optional(),
  }),
);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    max: z.union([z.number(), z.strictObject({ bonusOf: charKeySchema }), z.null()]),
    test: talentTestSchema.nullable(),
    desc: z.string(),
    descAA: z.string().optional(),
    specs: z.array(specEntrySchema).optional(),
    specsSource: specsSourceSchema.optional(),
    specsOpen: z.boolean().optional(),
    rand: z.number().nullable(),
    source: sourceRefSchema,
    effects: z.array(triggeredEffectSchema).optional(),
    passive: z.array(gameOpSchema).optional(),
    combat: combatFeatureSchema.optional(),
  }),
);

export type TalentsData = z.infer<typeof schema>;
