/**
 * Schéma de `talents.json` — dérivé de l'inventaire COMPLET des clés (script node, n=179/179), de
 * l'interface `TalentData` (`src/data/index.ts:311`), `TalentTest`/`TestMatch` (l.288-310) et
 * `CombatFeature` (`src/engine/combatFeatures/types.ts`). `effects` (`TriggeredEffect[]`) et son
 * `Flow` récursif (`src/engine/flowCore.ts`) sont PROMUS dans `common.ts` (`conditionSchema`/
 * `flowSchema`/`triggeredEffectSchema` — ex-dupliqués à l'identique dans talents/etats/spells).
 */
import { z } from 'zod';
import {
  charKeySchema, sourceRefSchema, gameOpSchema, conditionSchema, triggeredEffectSchema,
  combatFeatureSchema, variantSchema,
} from '../common';

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

// ── CombatFeature (src/engine/combatFeatures/types.ts) — PROMU dans `common.ts` (#563, SOURCE UNIQUE,
// ex-dupliqué ici) : `combatFeatureSchema`/`variantSchema` importés ci-dessus.

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
    /** Variantes réglées (#563/#564 — ex. Aux Armes Annexe I « Avantage de groupe »). NON migré ici
     *  (Lot 0 primitive only) : `descAA`/`combat.aa` restent la forme active tant que le Lot 4 ne les
     *  a pas portés dans `variants`. */
    variants: z.array(variantSchema).optional(),
    // Contenu de RÉFÉRENCE (PNJ/campagne, RAW cité par entrée) : hors graphe d'obtenabilité (#326).
    codexOnly: z.literal(true).optional(),
  }),
);

export type TalentsData = z.infer<typeof schema>;
