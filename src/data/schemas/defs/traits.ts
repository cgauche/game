/**
 * Schéma de `traits.json` — Traits de créature (LDB 85 + suppléments/frenchy.bzh), miroir de
 * `TraitData` (`src/data/index.ts:792-844`) + `TraitCapabilities` (`:730-790`).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, gameOpSchema, refSchema, entityAppearanceSchema, triggeredEffectSchema, charKeySchema, variantOf } from '../common';

export const file = 'traits.json';

const specsSourceSchema = z.enum([
  'weaponGroupsMelee',
  'weaponGroupsRanged',
  'winds',
  'arcaneDomains',
  'cultBlessings',
  'cultMiracles',
  'cultChaos',
  'seaShanties',
  'groups',
  'diseases',
  'sizes',
  'mutations',
  'breathTypes',
  'damageTypes',
  'weaponsMelee',
  'weaponsRanged',
]);

/** `TraitCapabilities` (`src/data/index.ts:730-790`) — clés OBSERVÉES dans `traits.json` (31/54 déclarées
 *  sur l'interface ; les autres appartiennent aux capabilities de qualités/symptômes ou sont réservées
 *  au bestiaire lu ailleurs). Schéma reflète l'INTERFACE complète (toutes optionnelles), pas seulement
 *  le sous-ensemble vu aujourd'hui — une future entrée peut légitimement en ajouter. */
const traitCapabilitiesSchema = z.strictObject({
  bonusWoundsBE: z.boolean().optional(),
  mutationAtSpawn: z.enum(['physique', 'mentale']).optional(),
  markMutations: z.strictObject({
    countDie: z.number(),
    countDivide: z.number(),
    first: z.enum(['physique', 'mentale']),
    mentalTable: z.string(),
    physTable: z.string(),
  }).optional(),
  swarm: z.boolean().optional(),
  naturalWeapon: z.strictObject({ ranged: z.boolean().optional() }).optional(),
  spellcaster: z.boolean().optional(),
  undead: z.boolean().optional(),
  wardSave: z.boolean().optional(),
  damageImmunity: z.boolean().optional(),
  spellDomainImmunity: z.string().optional(),
  counterOnDefenseWin: z.boolean().optional(),
  counterRequiresFastParry: z.boolean().optional(),
  unstable: z.boolean().optional(),
  painless: z.boolean().optional(),
  psychImmuneIfAhead: z.boolean().optional(),
  psychType: z.enum(['peur', 'terreur', 'animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']).optional(),
  psychImmune: z.boolean().optional(),
  psychIndice: z.number().optional(),
  psychCible: z.string().optional(),
  grantGroups: z.array(z.string()).optional(),
  frenzyCapable: z.boolean().optional(),
  mindless: z.boolean().optional(),
  woundsUseForce: z.boolean().optional(),
  freeTrample: z.boolean().optional(),
  bestial: z.boolean().optional(),
  coldBlooded: z.boolean().optional(),
  stupid: z.boolean().optional(),
  rage: z.boolean().optional(),
  territorial: z.boolean().optional(),
  skittishMount: z.boolean().optional(),
  structResistant: z.boolean().optional(),
  structImpenetrable: z.boolean().optional(),
  fly: z.boolean().optional(),
  leap: z.boolean().optional(),
  stride: z.boolean().optional(),
  autoClimb: z.boolean().optional(),
  climbFullSpeed: z.boolean().optional(),
  noRun: z.boolean().optional(),
  seesInDark: z.boolean().optional(),
  darkSightTiles: z.number().optional(),
  wakelessBite: z.boolean().optional(),
  /** ADE II 2 l.708 : « un ogre peut porter deux fois l'Encombrement normal d'un humain ». */
  encumbranceFactor: z.number().optional(),
  /** ADE II 2 l.708 : « les ogres doivent manger et boire au moins deux fois plus qu'un humain ». */
  consumptionFactor: z.number().optional(),
});

/** Entrée de `traits.json` SANS ses variantes — patron de `variantOf` (patch partiel de CETTE forme). */
const traitEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  indice: z.strictObject({ label: z.string() }).optional(),
  range: z.boolean().optional(),
  specsSource: specsSourceSchema.optional(),
  specsOpen: z.boolean().optional(),
  specsMulti: z.boolean().optional(),
  desc: z.string(),
  source: sourceRefSchema,
  /** Emplacements SECONDAIRES (#563, doctrine « jamais 2 talents différents ») — ex. `fouissement`
   *  ZI folio 23 ET 134, deux définitions complètes du même Trait. NON migré ici (Lot 0 primitive
   *  only) : `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn: z.array(secondarySourceRefSchema).optional(),
  effects: z.array(triggeredEffectSchema).optional(),
  grantsManeuvers: z.array(refSchema).optional(),
  passive: z.array(gameOpSchema).optional(),
  appearance: entityAppearanceSchema.optional(),
  capabilities: traitCapabilitiesSchema.optional(),
  suppressesCapabilities: z.array(z.string()).optional(),
  aura: z
    .strictObject({
      rangeChar: charKeySchema.optional(),
      rangeMeters: z.number().optional(),
      affects: z.enum(['enemies', 'allies', 'all']).optional(),
      passive: z.array(gameOpSchema),
    })
    .optional(),
  standard: z.boolean().optional(),
  /** Arbitrage NON-verbatim (`TraitData.maison`, `src/data/index.ts`) — même patron que
   *  `naval-traits.json`/`creatures.json`. */
  maison: z.string().optional(),
});

/**
 * Champs qu'une variante réglée de `traits.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` : `desc`/`source` → Codex `src/ui/compendium/registry.ts:483`. `capabilities`,
 * `passive`, `effects` et `aura` en sont ABSENTS : le moteur les lit sur l'entrée BRUTE
 * (`src/engine/traits/dispatch.ts:204,231,273`, `src/engine/items.ts:545`).
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source'] as const;

export const schema = z.array(
  traitEntrySchema.extend({
    /** Variantes réglées (#563/#564) — patch PARTIEL de l'entrée sur `VARIANT_RESOLVED_FIELDS` sous une
     *  règle optionnelle, résolu par `effectiveEntry` (`engine/variants.ts`, REPLACE par champ déclaré). */
    variants: z.array(variantOf(traitEntrySchema, VARIANT_RESOLVED_FIELDS)).optional(),
  }),
);

export type TraitsData = z.infer<typeof schema>;
