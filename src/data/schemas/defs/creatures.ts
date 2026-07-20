/**
 * Schéma de `creatures.json` — le BESTIAIRE (472 entrées), miroir de `CreatureData`
 * (`src/data/index.ts:504-550`). GROS dataset : inventaire de clés fait par script node sur
 * les 472 entrées (histogramme complet, pas d'échantillonnage).
 */
import { z } from 'zod';
import { sourceRefSchema, refSchema, trappingRefSchema, entityAppearanceSchema, traitInstanceSchema } from '../common';

export const file = 'creatures.json';

/** `OptionalEntry` (`src/engine/statEntry.ts`) — un élément d'`optionals` (LDB 76) : soit un
 *  `TraitInstance` ordinaire, soit une NOTE composée irréductible à un trait (discriminée par `note`) :
 *  joker « tous les traits » (Mutant, LDB 83 p.333) ou variante « remplacer des Traits par un bonus »
 *  (Grand Loup ZI 1 p.16, Griffon ZI). La note porte son `label` source VERBATIM + les champs d'application. */
const optionalWildcardSchema = z.strictObject({
  note: z.literal('all-traits'),
  label: z.string(),
});
const swapGrantSchema = z.union([
  z.strictObject({ char: z.string(), value: z.number() }),
  z.strictObject({ skillId: z.string(), spec: z.string().optional(), value: z.number() }),
]);
const optionalSwapSchema = z.strictObject({
  note: z.literal('swap'),
  label: z.string(),
  remove: z.array(z.string()),
  /** Un ou plusieurs octrois (Vouivre ZI : 4 — 3 caractéristiques + 1 compétence). */
  grant: z.array(swapGrantSchema),
  size: z.string().optional(),
  wounds: z.number().optional(),
});
const optionalEntrySchema = z.union([traitInstanceSchema, optionalWildcardSchema, optionalSwapSchema]);

/** `SkillRef` (`src/data/index.ts:1560-1562`) — `Ref` + valeur de Test imprimée. */
const skillRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), value: z.number() });

/** `TalentRef` (`src/data/index.ts:1576-1578`) — `Ref` + niveau facultatif. */
const talentRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() });

/** `HarvestRarity` = `Availability | 'Unique'` (`src/engine/types.ts:79`, `src/data/index.ts:501`). */
const harvestRaritySchema = z.enum(['Commune', 'Limitée', 'Rare', 'Exotique', 'Unique']);
/** `HarvestDanger` (`src/data/index.ts:502`). */
const harvestDangerSchema = z.enum(['Inoffensive', 'Inquiétante', 'Menaçante', 'Mortelle']);

const moneySchema = z.strictObject({ gold: z.number(), silver: z.number(), bronze: z.number() });

/** `Availability` (`src/engine/types.ts:79`) : « Commune »/« Limitée »/« Rare »/« Exotique ». */
const availabilitySchema = z.enum(['Commune', 'Limitée', 'Rare', 'Exotique']);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    title: z.string().nullable(),
    named: z.boolean().optional(),
    folder: z.string().nullable(),
    /** `Record<string, number|null>` (`src/data/index.ts:514`) — clés = abréviations de caractéristique
     *  (10 attendues : CC/CT/F/E/I/Ag/Dex/Int/FM/Soc, + M/B hors-jet vus ailleurs sur d'autres profils).
     *  `record` reste ouvert par construction (anomalie #1 de tête : clé `"undefined"` structurellement
     *  acceptée, mais fausse — à corriger à la main, pas un défaut de CE schéma). */
    char: z.record(z.string(), z.union([z.number(), z.null()])),
    traits: z.array(traitInstanceSchema),
    optionals: z.array(optionalEntrySchema),
    skills: z.array(skillRefSchema),
    talents: z.array(talentRefSchema),
    trappings: z.array(trappingRefSchema),
    spells: z.array(refSchema),
    desc: z.string().nullable(),
    source: sourceRefSchema,
    appearance: entityAppearanceSchema.optional(),
    harvest: z.strictObject({ rarity: harvestRaritySchema, danger: harvestDangerSchema, uses: z.string() }).optional(),
    group: z.string().optional(),
    followsCharacterRules: z.boolean().optional(),
    /** Facette ACHAT (montures, LDB 70 / EDOC 07). */
    purchase: z.strictObject({
      price: moneySchema,
      availability: availabilitySchema.optional(),
    }).optional(),
    /** Arbitrage NON-verbatim (`CreatureData.maison`, `src/data/index.ts`) — même patron que
     *  `ActivityData.maison`/`TraumaData.maison`. */
    maison: z.string().optional(),
  }),
);

export type CreaturesData = z.infer<typeof schema>;
