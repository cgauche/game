/**
 * Schéma de `talents.json` — dérivé de l'inventaire COMPLET des clés (script node, n=179/179), de
 * l'interface `TalentData` (`src/data/index.ts`), `TalentTest`/`TestMatch` (`src/data/index.ts`) et
 * `CombatFeature` (`src/engine/combatFeatures/types.ts`). `effects` (`TriggeredEffect[]`) et son
 * `Flow` récursif (`src/engine/flowCore.ts`) sont PROMUS dans `common.ts` (`conditionSchema`/
 * `flowSchema`/`triggeredEffectSchema` — partagés avec talents/etats/spells).
 */
import { z } from 'zod';
import {
  charKeySchema, sourceRefSchema, secondarySourceRefSchema, gameOpSchema, conditionSchema,
  triggeredEffectSchema, combatFeatureSchema, variantOf,
} from '../common';

export const file = 'talents.json';

const specsSourceSchema = z.enum([
  'weaponGroupsMelee', 'weaponGroupsRanged', 'winds', 'arcaneDomains', 'cultBlessings',
  'cultMiracles', 'cultChaos', 'seaShanties', 'groups', 'diseases', 'sizes', 'mutations',
  'breathTypes', 'damageTypes', 'weaponsMelee', 'weaponsRanged',
]);
const specEntrySchema = z.strictObject({ id: z.string(), label: z.string() });

// ── TestMatch / TalentTest (src/data/index.ts) ──────────────────────────────────────────────────
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

// ── CombatFeature (src/engine/combatFeatures/types.ts) — PROMU dans `common.ts` (#563, SOURCE
// UNIQUE) : `combatFeatureSchema`/`variantOf` importés ci-dessus.

/** Entrée de `talents.json` SANS ses variantes — sert de patron à `variantOf` (une variante est un
 *  patch partiel de CETTE forme) puis, étendue de `variants`, de schéma du dataset. */
const talentEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  max: z.union([z.number(), z.strictObject({ bonusOf: charKeySchema }), z.null()]),
  test: talentTestSchema.nullable(),
  desc: z.string(),
  specs: z.array(specEntrySchema).optional(),
  size: z.enum(['minuscule', 'tresPetite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']).optional(),
  specsSource: specsSourceSchema.optional(),
  /** Le `spec` de ce Talent nomme un CULTE (`gods.json`) : ses `grantGroups` sont accordés au
   *  porteur (`groupsFor`). Absent = le `spec` n'ouvre aucun Groupe d'appartenance. */
  grantSpecGroups: z.literal(true).optional(),
  /** Le `spec` de ce Talent nomme un Domaine arcanique (`DomainData.id`) que son porteur PRATIQUE : il
   *  compte alors dans les Domaines tenus et sous le plafond d'apprentissage (`LDB 46 l.177`, repris
   *  `VDM 02 l.190-192`) — lu par `heldArcaneDomains` (engine/careerSlots). Distinct de `specsSource`,
   *  qui ne décrit que le POOL de spécialisations proposé. */
  grantsArcaneDomain: z.literal(true).optional(),
  specsOpen: z.boolean().optional(),
  rand: z.number().nullable(),
  source: sourceRefSchema,
  /** Emplacements SECONDAIRES du MÊME Talent (doctrine « UNE entité, N livres ») : `source` reste
   *  l'ancre qui porte la `desc` ; ex. `empreint-d-ulgu`, republié en `VDM 13 l.485`. */
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  effects: z.array(triggeredEffectSchema).optional(),
  passive: z.array(gameOpSchema).optional(),
  combat: combatFeatureSchema.optional(),
  // Contenu de RÉFÉRENCE (PNJ/campagne, RAW cité par entrée) : hors graphe d'obtenabilité (#326).
  codexOnly: z.literal(true).optional(),
  /** Arbitrage NON-verbatim (`TalentData.maison`, `src/data/index.ts`) — même patron que
   *  `naval-traits.json`/`creatures.json`. */
  maison: z.string().optional(),
});

/**
 * Champs qu'une variante réglée de `talents.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` (`src/engine/variants.ts`), preuve par consommateur :
 *  - `desc`/`source` → Codex `src/ui/compendium/registry.ts`
 *  - `test` → `talentTestSLBonus` (`src/engine/magic.ts`)
 *  - `max` → `talentMaxById` (`src/engine/careerSlots.ts`), Apprentissage (`src/ui/InterludeScreen.tsx:722`)
 *  - `combat` → `featuresOf` (`src/engine/combatFeatures/dispatch.ts`), `castingKindOf` (l.17)
 * `passive`/`effects` en sont ABSENTS : `talentEffects.ts`/`characteristics.ts`/`combatManeuvers.ts`
 * les lisent sur l'entrée BRUTE — les y admettre ferait diverger le Codex du moteur.
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source', 'test', 'max', 'combat'] as const;

export const schema = z.array(
  talentEntrySchema.extend({
    /** Variantes réglées (#563/#564 — ex. Aux Armes Annexe III, gatées `combat-aa-avantage-groupe`) :
     *  patch PARTIEL de l'entrée sur `VARIANT_RESOLVED_FIELDS`, résolu par `effectiveEntry`
     *  (`engine/variants.ts`, REPLACE par champ déclaré) — SEULE lecture des consommateurs. */
    variants: z.array(variantOf(talentEntrySchema, VARIANT_RESOLVED_FIELDS)).optional(),
  }),
);
