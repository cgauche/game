/**
 * Schéma de `creatures.json` — le BESTIAIRE (472 entrées), miroir de `CreatureData`
 * (`src/data/index.ts:504-550`). GROS dataset : inventaire de clés fait par script node sur
 * les 472 entrées (histogramme complet, pas d'échantillonnage) — cf. anomalies ci-dessous.
 *
 * ANOMALIES relevées (à rapporter, PAS corrigées ici) :
 *  1. `nuee-de-nurglings.char` porte une clé littérale `"undefined"` (valeur 35) en plus des 10
 *     abréviations de caractéristique attendues — signe d'une caractéristique perdue lors d'une
 *     migration (clé JS `undefined` stringifiée). `char` reste un `Record<string, number|null>` (le
 *     schéma ACCEPTE donc cette clé structurellement), mais la donnée est fausse : à corriger à la
 *     main (retrouver la bonne abréviation, probablement B/Soc/Dex manquante pour cette entrée).
 *  2. 3 entrées portent un `optionals[]` SANS `id` (requis par `TraitInstance`,
 *     `src/engine/statEntry.ts:73-83`) mais avec un champ `key` (libellé descriptif, reliquat de
 *     pré-migration id-pure) : `mutant` (`{key:"Tous les traits"}`), `grand-loup`
 *     (`{key:"Taille ; remplacer Bestial, Dressé et Territorial par un bonus de en Soc", value:15,
 *     arg:"Grande"}`), `griffon-zoo-imperial` (`{key:"Remplacer Bestial par un bonus de en Soc",
 *     value:20}`). Le schéma reflète FIDÈLEMENT `TraitInstance` (id requis) → ces 3 entrées FONT
 *     ÉCHOUER le parse (attendu : ce sont de vraies dettes de migration, pas une variante légitime).
 *  3. `jaego-roth.trappings` porte `{ id:'crochet', text:'crochet de main' }` — `id` ET `text`
 *     ensemble, alors que `TrappingRef` (`src/data/index.ts:1753`) est une UNION exclusive
 *     (`Ref & {count?}` OU `{text, count?}`). Le schéma reflète l'union stricte → cette entrée fait
 *     ÉCHOUER le parse (vraie incohérence : soit c'est un objet catalogue `crochet` avec juste un
 *     libellé narratif superflu, soit `id` est de trop).
 */
import { z } from 'zod';
import { sourceRefSchema, refSchema, countSpecSchema, trappingRefSchema, entityAppearanceSchema } from '../common';

export const file = 'creatures.json';

/** `TraitInstance` (`src/engine/statEntry.ts:73-83`) — utilisé pour `traits`/`optionals`. Cf. anomalie
 *  #2 de tête : 3 entrées d'`optionals` n'ont PAS `id` (échec de parse attendu, dette réelle). */
const traitInstanceSchema = z.strictObject({
  id: z.string(),
  value: z.number().optional(),
  arg: z.string().optional(),
  count: z.number().optional(),
  range: z.number().optional(),
  natural: z.boolean().optional(),
});

/** `SkillRef` (`src/data/index.ts:1560-1562`) — `Ref` + valeur de Test imprimée. */
const skillRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), value: z.number() });

/** `TalentRef` (`src/data/index.ts:1576-1578`) — `Ref` + niveau facultatif. */
const talentRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() });

/** `HarvestRarity` = `Availability | 'Unique'` (`src/engine/types.ts:79`, `src/data/index.ts:501`). */
const harvestRaritySchema = z.enum(['Commune', 'Limitée', 'Rare', 'Exotique', 'Unique']);
/** `HarvestDanger` (`src/data/index.ts:502`). */
const harvestDangerSchema = z.enum(['Inoffensive', 'Inquiétante', 'Menaçante', 'Mortelle']);

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
    optionals: z.array(traitInstanceSchema),
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
  }),
);

export type CreaturesData = z.infer<typeof schema>;
