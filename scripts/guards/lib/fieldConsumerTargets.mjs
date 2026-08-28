// Périmètre RETENU du rapport « consommateurs par champ » (#903) — PARTAGÉ entre le générateur
// (`scripts/docs/build-field-consumers.mts`) et la garde (`src/data/field-consumers.test.ts`) :
// une seule source pour `TARGETS`, jamais une liste dupliquée entre les deux. Périmètre candidat et
// raisons d'exclusion : en-tête de `scripts/docs/build-field-consumers.mts`.
import * as valeurs from '../../../src/data/schemas/grammaire/valeurs'
import * as reference from '../../../src/data/schemas/grammaire/reference'
import * as mecanique from '../../../src/data/schemas/grammaire/mecanique'
import { critEscalationSchema, amputationSchema } from '../../../src/data/schemas/defs/criticals'
import {
  cles as propCles, propVolumeRecipeSchema, propPrimitiveSchema, propSeatSlotSchema,
  propPoint3Schema, propSize3Schema,
} from '../../../src/data/schemas/defs/props'

/** `type` = alias TS NOMMÉ vérifié à la main (`interface`/`type X = …` trouvé ailleurs dans le dépôt) —
 *  c'est ce qui permet à `scanFieldReads` de borner une lecture sur une annotation explicite. */
export const TARGETS = [
  { schema: reference.traitInstanceSchema, type: 'TraitInstance', home: 'src/engine/statEntry.ts' },
  { schema: valeurs.sourceRefSchema, type: 'SourceRef', home: 'src/data/schemas/grammaire/valeurs.ts' },
  { schema: valeurs.detailRecipeSchema, type: 'DetailRecipe', home: 'src/gameIso/detail/types.ts' },
  { schema: valeurs.diceSpecSchema, type: 'DiceSpec', home: 'src/engine/dice.ts' },
  { schema: reference.refSchema, type: 'Ref', home: 'src/data/index.ts' },
  { schema: reference.qualityRefSchema, type: 'QualityRef', home: 'src/data/index.ts' },
  { schema: valeurs.castingNumberModSchema, type: 'CastingNumberMod', home: 'src/engine/castingNumber.ts' },
  { schema: valeurs.countSpecSchema, type: 'CountSpec', home: 'src/data/index.ts' },
  { schema: reference.trappingRefSchema, type: 'TrappingRef', home: 'src/data/index.ts' },
  { schema: reference.advancementRefSchema, type: 'AdvancementRef', home: 'src/data/index.ts' },
  { schema: valeurs.entityAppearanceSchema, type: 'EntityAppearance', home: 'src/engine/authoringAppearance.ts' },
  { schema: mecanique.flowTestSchema, type: 'FlowTest', home: 'src/engine/flowCore.ts' },
  { schema: mecanique.travelTableEntrySchema, type: 'TravelTableEntry', home: 'src/engine/travelTables.ts' },
  { schema: mecanique.shipCrewTestSchema, type: 'ShipCrewTest', home: 'src/data/shipCriticals.ts' },
  { schema: mecanique.shipCritEntrySchema, type: 'ShipCritEntry', home: 'src/data/shipCriticals.ts' },
  // `PropData` est l'ENTRÉE d'un def adopté par `document()` : son nœud est SCELLé (pas de `.shape`).
  // Ses clés viennent donc du handle (`cles`, relevées avant le sceau) — un `schema:` ici rendrait
  // zéro champ EN SILENCE, et le rapport perdrait le type sans le dire.
  { cles: propCles, type: 'PropData', home: 'src/data/props.types.ts' },
  { schema: propVolumeRecipeSchema, type: 'PropVolumeRecipe', home: 'src/data/props.types.ts' },
  { schema: propPrimitiveSchema, type: 'PropPrimitive', home: 'src/data/props.types.ts' },
  { schema: propSeatSlotSchema, type: 'PropSeatSlot', home: 'src/data/props.types.ts' },
  { schema: propPoint3Schema, type: 'PropPoint3', home: 'src/data/props.types.ts' },
  { schema: propSize3Schema, type: 'PropSize3', home: 'src/data/props.types.ts' },
  { schema: critEscalationSchema, type: 'CritEscalation', home: 'src/data/criticals.ts' },
  { schema: amputationSchema, type: 'Amputation', home: 'src/data/criticals.ts' },
]

/** Champs top-level d'un schéma zod (`.shape`), fusionnés à travers les branches d'une union
 *  (`z.union`/`z.discriminatedUnion` — un champ présent sur UNE SEULE branche compte pour le type
 *  entier). PÉRIMÈTRE : les clés top-level. ANGLE MORT : le rapport ne distingue pas « lu sur la
 *  branche A » de « lu sur la branche B ». */
export function fieldsOf(schema) {
  // Une cible peut fournir ses clés TELLES QUELLES (`cles` d'un handle `document()`) : le nœud scellé
  // n'expose plus de `.shape`, et un rendu vide serait une perte muette.
  if (Array.isArray(schema)) return [...schema]
  if (schema?.shape) return Object.keys(schema.shape)
  const def = schema?._zod?.def ?? schema?.def
  if (def?.options) {
    const set = new Set()
    for (const o of def.options) for (const f of fieldsOf(o)) set.add(f)
    return [...set]
  }
  return []
}
