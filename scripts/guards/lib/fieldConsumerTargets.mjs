// Périmètre RETENU du rapport « consommateurs par champ » (#903) — PARTAGÉ entre le générateur
// (`scripts/docs/build-field-consumers.mts`) et la garde (`src/data/field-consumers.test.ts`) :
// une seule source pour `TARGETS`, jamais une liste dupliquée entre les deux. Détail de la mesure
// (39 schémas nommés candidats → 17 retenus, raisons d'exclusion) : en-tête de
// `scripts/docs/build-field-consumers.mts`.
import * as common from '../../../src/data/schemas/common'
import { critEscalationSchema, amputationSchema } from '../../../src/data/schemas/defs/criticals'

/** `type` = alias TS NOMMÉ vérifié à la main (`interface`/`type X = …` trouvé ailleurs dans le dépôt) —
 *  c'est ce qui permet à `scanFieldReads` de borner une lecture sur une annotation explicite. */
export const TARGETS = [
  { schema: common.traitInstanceSchema, type: 'TraitInstance', home: 'src/engine/statEntry.ts' },
  { schema: common.sourceRefSchema, type: 'SourceRef', home: 'src/data/schemas/common.ts' },
  { schema: common.detailRecipeSchema, type: 'DetailRecipe', home: 'src/gameIso/detail/types.ts' },
  { schema: common.diceSpecSchema, type: 'DiceSpec', home: 'src/engine/dice.ts' },
  { schema: common.refSchema, type: 'Ref', home: 'src/data/index.ts' },
  { schema: common.qualityRefSchema, type: 'QualityRef', home: 'src/data/index.ts' },
  { schema: common.castingNumberModSchema, type: 'CastingNumberMod', home: 'src/engine/castingNumber.ts' },
  { schema: common.countSpecSchema, type: 'CountSpec', home: 'src/data/index.ts' },
  { schema: common.trappingRefSchema, type: 'TrappingRef', home: 'src/data/index.ts' },
  { schema: common.advancementRefSchema, type: 'AdvancementRef', home: 'src/data/index.ts' },
  { schema: common.entityAppearanceSchema, type: 'EntityAppearance', home: 'src/engine/authoringAppearance.ts' },
  { schema: common.flowTestSchema, type: 'FlowTest', home: 'src/engine/flowCore.ts' },
  { schema: common.travelTableEntrySchema, type: 'TravelTableEntry', home: 'src/engine/travelTables.ts' },
  { schema: common.shipCrewTestSchema, type: 'ShipCrewTest', home: 'src/data/shipCriticals.ts' },
  { schema: common.shipCritEntrySchema, type: 'ShipCritEntry', home: 'src/data/shipCriticals.ts' },
  { schema: critEscalationSchema, type: 'CritEscalation', home: 'src/data/criticals.ts' },
  { schema: amputationSchema, type: 'Amputation', home: 'src/data/criticals.ts' },
]

/** Champs top-level d'un schéma zod (`.shape`), fusionnés à travers les branches d'une union
 *  (`z.union`/`z.discriminatedUnion` — un champ présent sur UNE SEULE branche compte pour le type
 *  entier, angle mort assumé : ce rapport ne distingue pas « lu sur la branche A » de « … B »). */
export function fieldsOf(schema) {
  if (schema?.shape) return Object.keys(schema.shape)
  const def = schema?._zod?.def ?? schema?.def
  if (def?.options) {
    const set = new Set()
    for (const o of def.options) for (const f of fieldsOf(o)) set.add(f)
    return [...set]
  }
  return []
}
