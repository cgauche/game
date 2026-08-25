/**
 * VALEURS de la grammaire de document (#1466 L1a) — les types de VALEUR partagés par tout document
 * de l'application : source, dés, formule, difficulté, caractéristique, localisation, apparence,
 * variante réglée, recette de détail. Aucune dépendance à la RÉFÉRENCE ni à la MÉCANIQUE : ce
 * fichier est la feuille du graphe de la grammaire.
 */
import { z } from 'zod';
import { AVAILABILITIES, STAKE_FORMS } from '../../../engine/types';

/**
 * Disponibilité (`Availability`, `src/engine/types.ts`) — le schéma DÉRIVE du tuple canon au lieu de
 * retaper ses 4 paliers : c'est la porte unique des defs (`disponibilite`, `creatures`, `vehicles`,
 * `trappings`).
 */
export const availabilitySchema = z.enum(AVAILABILITIES);

/**
 * Rareté d'une pièce de créature récoltée (`HarvestRarity`, `src/data/index.ts`) = les paliers de
 * Disponibilité + `'Unique'`. Le 5ᵉ palier est RAW, pas une dérive : la table « COÛT DE BASE POUR
 * 1 ENC DE PIÈCES DE CRÉATURE BRUTES » imprime cinq colonnes (`ZI 13 l.286`).
 */
export const harvestRaritySchema = z.enum([...AVAILABILITIES, 'Unique']);

/**
 * Forme déclarée d'un texte d'enjeu (`StakeForm`, `src/engine/types.ts`) — porte unique des 6 defs
 * qui portent un enjeu (`night-stakes`, `flow-stakes`, `combat-stakes`, `activities`, `psychology`,
 * `maneuvers`). L'OPTIONALITÉ reste au site : elle se décide par def, pas ici.
 */
export const stakeFormSchema = z.enum(STAKE_FORMS);

/**
 * Réf de source récurrente `{ book, page }` — vue sur 2-3 datasets (`characteristics.json`,
 * `species.json`/`SpeciesData.source`, `careers.json`/`CareerData.source` dans `src/data/index.ts`) :
 * même forme partout. `book` = id de `books.json` (id-pur, cf. commit `21aa4881`) ; `page` = folio
 * IMPRIMÉ du livre, JAMAIS l'index de la ré-extraction Marker (piège documenté :
 * `game-source-page-is-printed-folio`).
 */
export const sourceRefSchema = z.strictObject({
  book: z.string(),
  page: z.number(),
  /** Précision optionnelle (ch./l. du passage, portée VERBATIM…). Aucune LOGIQUE DE JEU ne la lit ;
   *  une GARDE la lit désormais : quand elle est de la forme `<ABRÉV> <ch> l.<ligne>`,
   *  `scripts/guards/lib/folioLineAlign.mjs` la confronte au marqueur `data-folio` qui gouverne cette
   *  ligne — `page` et `note` doivent désigner le même endroit (#1318 E8). Toute autre forme est
   *  ignorée par la garde (aucune contrainte de saisie ajoutée). */
  note: z.string().optional(),
});

/** Vue TS de `sourceRefSchema` — SEULE forme à importer côté `src/data/index.ts` (jamais `{ book:
 *  string; page: number }` inline, F20). Réf de source UNIQUE du repo (#278) : posée par ENTRÉE sur
 *  les datasets d'extraction de table RAW (`sea-events`/`sea-navigation`/`sea-perils`/`sea-weather`/
 *  `ship-construction`/`naval-progression`/`crew-morale`/`crew-test-types`/`mass-battle`/
 *  `land-cargo`/`sea-cargo`/`river-navigation`/`river-perils`), à la racine quand le dataset est un
 *  objet de config unique plutôt qu'une liste. */
export type SourceRef = z.infer<typeof sourceRefSchema>;

/**
 * Emplacement SECONDAIRE d'une entrée définie à plusieurs endroits (#563 — doctrine user 2026-07-17 :
 * « jamais 2 talents différents », mais un même Talent/Trait/Qualité peut être réimprimé ailleurs).
 * L'ANCRE (`source`, scalaire, inchangée) reste seule à porter la `desc` (règle stricte 5,
 * STRUCTURELLE — jamais `refs[0]` positionnel, indémontable par réordonnancement d'éditeur).
 * `quote` = auto-attestation authorée (verbatim, prouvable dans le span du folio déclaré) pour les cas
 * où le `label` de l'entrée n'apparaît pas tel quel dans ce span (ex. une TABLE imprime un nom
 * différent — `zweihander-flamberge`) : charge de la preuve sur l'auteur, comme `desc` pour l'ancre.
 */
export const secondarySourceRefSchema = sourceRefSchema.extend({
  /** Preuve verbatim authorée que l'entrée est bien à cet emplacement (ligne de stats d'une table,
   *  phrase distinctive…) — distinct de `note` (display-only, jamais vérifié). */
  quote: z.string().optional(),
});
/** Vue TS de `secondarySourceRefSchema` — porté par le champ `alsoIn?: SecondaryRef[]` de toute
 *  entrée multi-emplacement. Accesseurs `allLocations`/`sourceBooks` (`src/data/index.ts`). */
export type SecondaryRef = z.infer<typeof secondarySourceRefSchema>;

/**
 * Note de provenance LIBRE `_source` — SURVIT uniquement pour `aa-criticals.json` (#278). ATTENTION —
 * motif RÉVISÉ (#563, 2026-07-17) : « Aux Armes n'a AUCUNE extraction Markdown » était PÉRIMÉ — l'extraction
 * Marker de `Source/WH - V4 - Aux Armes` EXISTE et porte des spans `data-folio` (13 chapitres, ex.
 * `10 - L'ARTILLERIE…md` en compte 15). Le vrai motif : les tables de Blessures Critiques par
 * Localisation d'`aa-criticals.json` citent un intervalle APPROXIMATIF (`p.≈118-124`, note libre du
 * fichier) et n'ont jamais été migrées en `source: sourceRefSchema` PAR ENTRÉE — pas un blocage
 * d'extraction, une migration non faite. Ne pas réutiliser ailleurs (`sourceRefSchema` + `note`
 * couvre tous les autres cas).
 */
export const freeSourceNoteSchema = z.string();

// ============================================================================
// COMBAT FEATURE (`src/engine/combatFeatures/types.ts`) — sac de flags CLOS conféré par un Talent/Trait,
// `aa` récursif (variante « Avantage de groupe », Aux Armes Annexe I). Promu ici (partagé avec
// `talents.ts`) : SOURCE UNIQUE pour tout schéma qui porte `combat`/`variants[].combat`.
// La FORME est retapée ici, pas dérivée : `CombatFeature` est un TYPE, sans contrepartie runtime à
// importer (au contraire d'`AVAILABILITIES`/`STAKE_FORMS`, tuples importés de `src/engine/types` l.8).
// Reflet FIDÈLE de l'interface TS — une dérive rougit au parse des données qui portent `combat`.
// ============================================================================

export const castingKindSchema = z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']);

export const combatFeatureSchema: z.ZodType<unknown> = z.lazy(() =>
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
    pursuitTargetBonus: z.boolean().optional(),
    shieldAdvantage: z.boolean().optional(),
    advantageDefenseReaction: z.strictObject({ cost: z.number() }).optional(),
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
    focusNoMiscastOnDouble: z.boolean().optional(),
    castNoMiscastOnDouble: z.boolean().optional(),
    causesFear: z.boolean().optional(),
    reverseFailed: z.strictObject({ skill: z.union([z.string(), z.array(z.string())]), spec: z.string().optional(), capDR: z.number().optional() }).optional(),
    bargainBonus: z.boolean().optional(),
    encumbranceBonus: z.boolean().optional(),
    corruptionThreshold: z.boolean().optional(),
    surgery: z.boolean().optional(),
    castingKind: castingKindSchema.optional(),
    commandTeam: z.boolean().optional(),
    seaShanty: z.boolean().optional(),
    critRollTwice: z.boolean().optional(),
  }),
);

/**
 * `RuleValue` (`src/engine/policy.ts:44`) — valeur effective d'une règle optionnelle du registre
 * `OPTIONAL_RULES` (`policy.ts:43`, lue par `rule(id)`). Union fermée retapée, même raison que
 * `combatFeatureSchema` ci-dessus : le type n'a pas de contrepartie runtime à dériver.
 */
export const ruleValueSchema = z.union([z.boolean(), z.number(), z.string()]);

/** Garde d'une variante RÉGLÉE : la règle optionnelle visée et la valeur attendue. `rule` DOIT être
 *  un id du registre `OPTIONAL_RULES` (`src/engine/policy.ts:43`), jamais un label ni un flag
 *  parallèle (gardes `src/data/variants-integrity.test.ts`) ; `equals` défaut `true`. */
export const variantWhenSchema = z.strictObject({ rule: z.string(), equals: ruleValueSchema.optional() });

/**
 * Fabrique de VARIANTE d'un dataset (#563/#564 — ex. « Aux Armes, Annexe I : Avantage de groupe »).
 * Une variante est un PATCH PARTIEL de l'entrée, TYPÉ PAR SON DATASET et RESTREINT aux champs que ce
 * dataset RÉSOUT réellement par `effectiveEntry` : `resolved` est la liste blanche, chaque def
 * déclare la sienne (`VARIANT_RESOLVED_FIELDS`) et n'y inscrit un champ qu'une fois son consommateur
 * routé par `effectiveEntry` — un champ admis mais lu BRUT ferait diverger l'affichage et le moteur.
 * À composer dans chaque def :
 * `variants: z.array(variantOf(<schéma d'ENTRÉE, sans le champ `variants`>, VARIANT_RESOLVED_FIELDS)).optional()`.
 *
 * Sémantique de fusion : REPLACE par champ DÉCLARÉ, au premier niveau (`effectiveEntry`,
 * `src/engine/variants.ts`) — un champ absent de la variante est hérité de l'entrée de base, un champ
 * présent remplace celui de base EN ENTIER (le livre republie l'entrée entière ; aucune fusion profonde
 * implicite). `desc`/`source` d'une variante portent la règle stricte 5 (verbatim + folio) comme
 * l'ancre — `folioIntegrity.mjs:citedEntriesOf` les découvre déjà à toute profondeur (#563 Lot 3).
 */
export function variantOf<T extends z.ZodRawShape, K extends Extract<keyof T, string>>(
  entrySchema: z.ZodObject<T>,
  resolved: readonly K[],
) {
  const mask = Object.fromEntries(resolved.map((k) => [k, true]));
  const picked = entrySchema.pick(mask as Parameters<typeof entrySchema.pick>[0]) as unknown as z.ZodObject<Pick<T, K>>;
  return picked.partial().extend({ when: variantWhenSchema });
}

/** Vue TS COMMUNE d'une variante — le contrat de FORME (runtime) est celui de `variantOf` par dataset ;
 *  cette vue expose les champs partagés par tous les porteurs et laisse les autres en `unknown`. Portée
 *  par le champ `variants?: Variant[]` de toute entrée à variante réglée (`activeVariant`/`effectiveEntry`,
 *  `src/engine/variants.ts`). */
export type Variant = {
  when: { rule: string; equals?: z.infer<typeof ruleValueSchema> };
  desc?: string;
  source?: SourceRef;
  [field: string]: unknown;
};

/**
 * Recette de détail de surface (`DetailRecipe`, `src/gameIso/detail/types.ts`) — portée par le champ
 * optionnel `detail` de 3 datasets d'apparence (`roofMaterials.json`, `reliefMaterials.json`,
 * `structureAppearance.json`). Reflet STRICT de l'interface TS (mêmes sous-objets/champs requis).
 */
export const detailRecipeSchema = z.strictObject({
  courses: z
    .strictObject({
      hM: z.number(),
      joint: z.string(),
      jointW: z.number(),
      stagger: z.number().optional(),
      blockWM: z.tuple([z.number(), z.number()]).optional(),
      edgeWobble: z.number().optional(),
      paletteVar: z.number().optional(),
    })
    .optional(),
  bands: z.array(z.strictObject({ atV: z.number(), hM: z.number(), color: z.string() })).optional(),
  timber: z
    .strictObject({
      postEveryM: z.number(),
      braces: z.enum(['X', 'V']).optional(),
      wM: z.number(),
      color: z.string(),
    })
    .optional(),
  speckle: z
    .strictObject({
      perM2: z.number(),
      rM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
      vBias: z.number().optional(),
    })
    .optional(),
  tufts: z
    .strictObject({
      perM2: z.number(),
      hM: z.tuple([z.number(), z.number()]),
      colors: z.array(z.string()),
    })
    .optional(),
  tintVar: z.number().optional(),
  seedScope: z.enum(['edge', 'tile', 'instance']),
});

/**
 * Niveau de `Difficulty` (`src/engine/types.ts`) tel qu'il apparaît en DONNÉE — vu sur plusieurs
 * datasets naval-commerce (`sea-navigation.json`, `sea-cargo.json`, `land-cargo.json`,
 * `sea-weather.json`) qui portent tous des champs `difficulty`/`*Difficulty` typés `Difficulty` par
 * leurs consommateurs (`DATA as unknown as { ... difficulty: Difficulty ... }`). Les 10 valeurs du
 * type canon (LDB Tests + extrêmes EDO App.2) — pas seulement le sous-ensemble présent aujourd'hui —
 * car c'est le type que les consommateurs attendent, une future entrée peut légitimement en ajouter.
 */
export const difficultySchema = z.enum([
  'tresFacile',
  'facile',
  'accessible',
  'intermediaire',
  'complexe',
  'difficile',
  'tresDifficile',
  'presqueImpossible',
  'impossible',
]);

/**
 * `CharKey` (`src/engine/types.ts`) — les 10 Caractéristiques. Réf récurrente (Conditions `compare`,
 * `Formula.bonusOf`/`charOf`, `FlowTest.characteristic`, `AdvancementRef`…) — porte UNIQUE des defs qui
 * nomment une Caractéristique (`domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`species`/
 * `careerLevels`…).
 */
export const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

/** `DiceSpec` (`src/engine/dice.ts`) — jet `{n, sides, plus?}`, partagé par `CountSpec.roll` et `Formula.dice`. */
export const diceSpecSchema = z.strictObject({ n: z.number(), sides: z.number(), plus: z.number().optional() });

/**
 * `raceKey` — id STABLE des 7 espèces jouables (LDB + suppléments), patron `defs/characteristics`
 * (#310). Clé de `species.json.refChar`, `hairs.json`/`eyes.json.color`, `details.json.ageBase`/
 * `ageRoll`/`heightBase`/`heightRoll` (#313 — ces 4 Record étaient label-keyés). `names.json` en
 * reste EXCLU par exception documentée (`defs/names.ts`) : le label EST la donnée affichée.
 */
export const raceKeySchema = z.enum(['humain', 'halfling', 'nain', 'gnome', 'ogre', 'haut-elfe', 'elfe-sylvain']);
export type RaceKey = z.infer<typeof raceKeySchema>;

/**
 * `refCareerId` — `raceKeySchema` + 4 variantes culturelles humaines (Middenheim/Middenland/
 * Nordland/Norse) du Tableau des Classes et Carrières aléatoires (LDB 05 l.197+). Clé de
 * `species.json.refCareer` et `careers.json.rand` (#313).
 */
export const refCareerIdSchema = z.enum([
  'humain', 'halfling', 'nain', 'gnome', 'ogre', 'haut-elfe', 'elfe-sylvain',
  'middenheim', 'middenland', 'nordland', 'norse',
]);
export type RefCareerId = z.infer<typeof refCareerIdSchema>;

/**
 * `CastingNumberMod` (`src/engine/castingNumber.ts`) — modificateur de NIVEAU D'INCANTATION porté
 * par un objet, un lieu, un support de lecture ou une Activité. Partagé par tous les datasets qui
 * en portent (`arcane-phenomena.json`, `rituals.json`).
 */
export const castingNumberModSchema = z
  .strictObject({
    multiply: z.number().optional(),
    divide: z.number().optional(),
    round: z.enum(['inferieur', 'superieur']).optional(),
    delta: z.number().optional(),
    min: z.number().optional(),
    scope: z
      .strictObject({
        domains: z.array(z.string()).min(1).optional(),
        domainsExcept: z.array(z.string()).min(1).optional(),
        chaosMagic: z.boolean().optional(),
        spellIds: z.array(z.string()).min(1).optional(),
        kinds: z.array(z.enum(['sort', 'rituel'])).min(1).optional(),
      })
      .optional(),
    /** Valeur maison ÉDITABLE portant sa justification, quand le RAW laisse un point ouvert
     *  (sens d'arrondi non imprimé…) — CLAUDE.md règle 7. */
    maison: z.string().optional(),
    source: sourceRefSchema,
    /** Passage RAW VERBATIM qui porte le modificateur (règle stricte 5). */
    desc: z.string(),
  })
  .refine((m) => m.divide == null || m.round != null, {
    message: 'castingNumberMod : une division de NI doit déclarer son sens d’arrondi (`round`)',
  })
  .refine((m) => m.multiply != null || m.divide != null || m.delta != null, {
    message: 'castingNumberMod : un modificateur sans `multiply`/`divide`/`delta` ne modifie rien',
  });

/** `CountSpec` (`src/data/index.ts`) — quantité fixe ou tirage de dés. Dupliqué dans `careerLevels`/
 *  `classes`/`creatures`. */
export const countSpecSchema = z.union([
  z.strictObject({ fixed: z.number() }),
  z.strictObject({ roll: diceSpecSchema }),
]);

/** `EntityAppearance` (`src/engine/authoringAppearance.ts`) — apparence d'entité (créature/trait/mutation).
 *  Dupliqué à l'identique dans `creatures`/`traits` ; `mutations` l'étend d'un `legs` anomalique
 *  (cf. `mutations.ts`, non repris ici — anomalie propre à ce seul dataset). */
export const entityAppearanceSchema = z.strictObject({
  seed: z.number().optional(),
  monster: z
    .strictObject({
      tete: z.string().optional(),
      brasG: z.string().optional(),
      brasD: z.string().optional(),
      jambes: z.string().optional(),
      cornes: z.boolean().optional(),
      queue: z.boolean().optional(),
      ailes: z.boolean().optional(),
    })
    .optional(),
  colors: z
    .strictObject({
      peau: z.string().optional(),
      cheveux: z.string().optional(),
      yeux: z.string().optional(),
      vet1: z.string().optional(),
      vet2: z.string().optional(),
      cuir: z.string().optional(),
      metal: z.string().optional(),
      corps: z.string().optional(),
      accent: z.string().optional(),
    })
    .optional(),
  parts: z.strictObject({ cheveux: z.number().optional(), visage: z.number().optional() }).optional(),
  sex: z.enum(['M', 'F']).optional(),
  build: z.number().optional(),
  species: z.string().optional(),
  tenue: z.string().optional(),
  /** Set d'ÉQUIPEMENT quadrupède porté (id du registre `gameIso/rig/quadruped/harnais`, #1128) —
   *  absent = bête nue. */
  harnais: z.string().optional(),
  /** Armure de statblock (PA par localisation, sans inventaire) VISIBLE/portée (#774) — défaut
   *  absent : les PA restent mécaniques PURS, aucun art d'armure synthétisé (nu de l'espèce/naturel). */
  armurePortee: z.boolean().optional(),
  eyes: z.strictObject({ G: z.string().optional(), D: z.string().optional() }).optional(),
  features: z.array(z.string()).optional(),
});

/** `HitLocation` (`src/engine/types.ts`) — 6 zones de touche (dé inversé, LDB). Resserré depuis
 *  `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) sur l'enum SOURCE : aucune des 9 JSON
 *  ne porte de valeur hors de ces 6 (vérifié au parse). */
export const hitLocationSchema = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);

/** `Formula` (`src/engine/ops.ts:65`) — quantité résolue à l'application (littéral/dés/bonus/Indice/
 *  jet-associé/pions/écart d'Avantage/Blessures/somme/facteur). Dupliqué (avec `bonusOf`/`charOf` en
 *  `z.string()` plutôt que `charKeySchema`) dans `trappings.ts` — resserré ici sur `CharKey` (fidèle
 *  à `src/engine/ops.ts:65`), sans risque pour `trappings.json` (vérifié au parse). */
export const formulaSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ bonusOf: charKeySchema }),
    z.strictObject({ charOf: charKeySchema }),
    z.strictObject({ dice: diceSpecSchema }),
    z.strictObject({ rolled: z.literal(true) }),
    z.strictObject({ indiceOf: z.literal(true) }),
    z.strictObject({ stacks: z.literal('self') }),
    z.strictObject({ engagedAdvantageGap: z.literal(true) }),
    z.strictObject({ woundsDealt: z.literal(true) }),
    z.strictObject({ sum: z.array(formulaSchema) }),
    // `factor` est une Formula (PRODUIT de deux formules — « (Force Mentale) × 1d10 minutes », VDM 05).
    z.strictObject({ times: z.strictObject({ of: formulaSchema, factor: formulaSchema }) }),
  ]),
);
