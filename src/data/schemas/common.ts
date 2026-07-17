/**
 * Schémas zod PARTAGÉS entre les defs de `src/data/schemas/defs/*.ts` (contrat de donnée, Lot 1 —
 * docs/plans/2026-07-06-perennite-10-ans-design.md). Un besoin récurrent (GameOp, réf de source…)
 * se factorise ICI — jamais recopié dans chaque def.
 */
import { z } from 'zod';

/**
 * Un `GameOp` (`src/engine/ops.ts`) tel qu'il apparaît en DONNÉE : forme LOOSE — seul `op` (le nom
 * de l'opération) est garanti par tous les vocabulaires ; les champs restants varient par `op` et
 * sont déjà validés au vocabulaire par `data-wellformed` (moteur). Ce schéma ne vérifie que la
 * FORME (un objet avec un `op` string), pas la sémantique de l'opération.
 */
export const gameOpSchema = z.looseObject({ op: z.string() });

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
  /** Précision optionnelle (ch./l. du passage, portée VERBATIM…) — display-only, jamais parsée. */
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
 * Note de provenance LIBRE `_source` — SURVIT uniquement pour `aa-criticals.json` (#278) : « Aux
 * Armes ! » n'a AUCUNE extraction Markdown avec spans `data-folio` dans `Source/` (seul le PDF brut
 * existe, > 100 Mo, illisible par l'outillage) — impossible de retrouver un folio IMPRIMÉ vérifiable
 * par entrée sans fabriquer la valeur. Migration en `source: sourceRefSchema` par entrée BLOQUÉE tant
 * qu'une extraction Marker de ce livre n'existe pas ; ne pas réutiliser ailleurs (`sourceRefSchema` +
 * `note` couvre tous les autres cas).
 */
export const freeSourceNoteSchema = z.string();

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
 * `Formula.bonusOf`/`charOf`, `FlowTest.characteristic`, `AdvancementRef`…) — dupliquée à l'identique
 * dans ~10 defs (`domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`species`/`careerLevels`…)
 * avant cette promotion.
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
 * `Ref` (`src/data/index.ts`) — réf structurée par id + spec optionnelle (talent/sort/manœuvre/dieu
 * ciblé). Dupliqué à l'identique dans `careerLevels`/`classes`/`creatures`/`gods`/`species`/`traits`.
 */
export const refSchema = z.strictObject({ id: z.string(), spec: z.string().optional() });

/** `CountSpec` (`src/data/index.ts`) — quantité fixe ou tirage de dés. Dupliqué dans `careerLevels`/
 *  `classes`/`creatures`. */
export const countSpecSchema = z.union([
  z.strictObject({ fixed: z.number() }),
  z.strictObject({ roll: diceSpecSchema }),
]);

/** `TrappingRef` (`src/data/index.ts`) — par id de catalogue (+ quantité), ou texte narratif hors
 *  catalogue (+ quantité). Dupliqué dans `careerLevels`/`classes`/`creatures`. */
export const trappingRefSchema = z.union([
  refSchema.extend({ count: countSpecSchema.optional() }),
  z.strictObject({ text: z.string(), count: countSpecSchema.optional() }),
]);

/** `AdvancementRef` (`src/data/index.ts`) — emplacement d'avancement : réf simple, joker « (Au choix) »
 *  (+ `specOptions`), choix « A ou B » (récursif), ou tirage aléatoire. Dupliqué dans `careerLevels`/`species`. */
export const advancementRefSchema: z.ZodType<
  | { ref: { id: string; spec?: string } }
  | { wildcard: { id: string; spec?: string }; specOptions?: string[] }
  | { choice: unknown[] }
  | { random: number }
> = z.union([
  z.strictObject({ ref: refSchema }),
  z.strictObject({ wildcard: refSchema, specOptions: z.array(z.string()).optional() }),
  z.strictObject({ choice: z.array(z.lazy(() => advancementRefSchema)) }),
  z.strictObject({ random: z.number() }),
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
  eyes: z.strictObject({ G: z.string().optional(), D: z.string().optional() }).optional(),
  features: z.array(z.string()).optional(),
});

// ============================================================================
// FLOW CORE (`src/engine/flowCore.ts`) — Condition / FlowTest / Flow / TriggeredEffect. SOURCE UNIQUE
// pour `domains`/`maneuvers`/`qualities`/`talents`/`etats`/`spells`/`traits`/`trappings`/`psychology`,
// qui redéclaraient CHACUN cette algèbre (à l'identique ou avec des libertés locales — cf. écarts
// absorbés ci-dessous, chaque dataset re-testé au parse après rewire).
// ============================================================================

export const compareOpSchema = z.enum(['>=', '<=', '==', '<', '>']);
export const actorRefSchema = z.enum(['target', 'caster']);
/** `HitLocation` (`src/engine/types.ts`) — 6 zones de touche (dé inversé, LDB). Resserré depuis
 *  `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) sur l'enum SOURCE : aucune des 9 JSON
 *  ne porte de valeur hors de ces 6 (vérifié au parse). */
export const hitLocationSchema = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);
/** `Relation | Camp` (`src/engine/relations.ts`) — union complète lue par la Condition `relation`.
 *  Resserré depuis `z.string()` (variantes `domains`/`talents`/`etats`/`spells`) : les 9 JSON ne
 *  portent que `'opponent'` aujourd'hui, sans-risque vis-à-vis de l'enum SOURCE (vérifié au parse). */
export const relationOrCampSchema = z.enum(['self', 'ally', 'opponent', 'party', 'neutral', 'hostile']);

const charRefSchema = z.strictObject({ who: actorRefSchema, char: charKeySchema, bonus: z.boolean().optional() });
const compareSubjectSchema = z.union([
  z.strictObject({ who: actorRefSchema, field: z.enum(['woundsCurrent', 'woundsMax', 'size', 'advantage']) }),
  z.strictObject({ who: actorRefSchema, condition: z.string() }),
  charRefSchema,
]);
/** `CompareSubject & { factor?: number }` (`engine/flowCore.ts:131`) — un `z.intersection` d'un
 *  `z.union` de `strictObject` NE FONCTIONNE PAS avec zod (chaque branche strict rejette les clés des
 *  autres, cf. `domains.ts` avant ce rewire : `z.intersection(compareSubjectSchema, …)` échouait sur
 *  `etats.json` #14 « inondation » — `{who,char:'E',factor:0.5}` — vérifié en isolation). Reflet FIDÈLE
 *  à la donnée réelle : un SEUL `strictObject` fusionnant les 3 formes (`field`/`condition`/`char`+`bonus`)
 *  + `factor`, tous optionnels sauf `who` — forme déjà éprouvée par talents/etats/spells/qualities/maneuvers. */
const compareValueSchema = z.union([
  z.number(),
  z.strictObject({
    who: actorRefSchema,
    field: z.enum(['woundsCurrent', 'woundsMax', 'size', 'advantage']).optional(),
    condition: z.string().optional(),
    char: charKeySchema.optional(),
    bonus: z.boolean().optional(),
    factor: z.number().optional(),
  }),
]);

/** `Condition` (`engine/flowCore.ts:112`) — algèbre CLOSE, récursive via `all`/`any`/`not`. */
export const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('always') }),
    z.strictObject({ kind: z.literal('flag'), expr: z.string() }),
    z.strictObject({
      kind: z.literal('time'),
      window: z.strictObject({
        afterHour: z.number().optional(),
        afterMinute: z.number().optional(),
        beforeHour: z.number().optional(),
        beforeMinute: z.number().optional(),
      }),
    }),
    z.strictObject({ kind: z.literal('hasItem'), trappingId: z.string(), count: z.number().optional() }),
    z.strictObject({
      kind: z.literal('money'),
      atLeast: z.strictObject({ gold: z.number().optional(), silver: z.number().optional(), brass: z.number().optional() }),
    }),
    z.strictObject({ kind: z.literal('partyDead'), who: z.enum(['any', 'all']) }),
    z.strictObject({ kind: z.literal('compare'), subject: compareSubjectSchema, op: compareOpSchema, value: compareValueSchema }),
    z.strictObject({ kind: z.literal('slThreshold'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('location'), is: hitLocationSchema }),
    z.strictObject({ kind: z.literal('attackKind'), is: z.string() }),
    z.strictObject({ kind: z.literal('startleCause'), is: z.enum(['noise', 'magic']) }),
    z.strictObject({ kind: z.literal('woundsDealt'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('engagedAdvantageGap'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('engagedAdvantageLead'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('foeInLoS') }),
    z.strictObject({ kind: z.literal('hiddenFromFoes') }),
    z.strictObject({ kind: z.literal('engaged') }),
    z.strictObject({ kind: z.literal('crewTest') }),
    z.strictObject({ kind: z.literal('nearestFoe'), op: compareOpSchema, value: z.number() }),
    z.strictObject({ kind: z.literal('capability'), who: actorRefSchema, id: z.string(), op: compareOpSchema.optional(), value: z.number().optional() }),
    z.strictObject({ kind: z.literal('relation'), who: actorRefSchema, is: relationOrCampSchema }),
    z.strictObject({ kind: z.literal('has'), who: actorRefSchema, what: z.enum(['group', 'talent', 'trait', 'psych']), value: z.string(), spec: z.string().optional() }),
    z.strictObject({ kind: z.literal('casterChaosDomain'), is: z.string() }),
    z.strictObject({ kind: z.literal('all'), of: z.array(conditionSchema) }),
    z.strictObject({ kind: z.literal('any'), of: z.array(conditionSchema) }),
    z.strictObject({ kind: z.literal('not'), of: conditionSchema }),
  ]),
);

/** `FlowTest` (`engine/flowCore.ts:335`) — jet différé (→ modale), tout le métier hors branches. */
export const flowTestSchema = z.strictObject({
  skill: z.string().optional(),
  spec: z.string().optional(),
  sense: z.enum(['vue', 'ouie']).optional(),
  characteristic: charKeySchema.optional(),
  difficulty: difficultySchema.optional(),
  requireSL: z.number().optional(),
  label: z.string().optional(),
  tool: z.string().optional(),
  vsGroups: z.array(z.string()).optional(),
  vsStatus: z.string().optional(),
  begging: z.boolean().optional(),
  vsCapricieux: z.boolean().optional(),
  easierIf: z
    .strictObject({
      hasSkill: z.strictObject({ id: z.string(), spec: z.string().optional() }).optional(),
      hasTalent: z.string().optional(),
      steps: z.number().optional(),
    })
    .optional(),
  argDifficulty: z.boolean().optional(),
  unlessImmune: z.string().optional(),
  onlyGroups: z.array(z.string()).optional(),
  exceptGroups: z.array(z.string()).optional(),
  gate: conditionSchema.optional(),
  menace: z.string().optional(),
  difficultyBy: z.array(z.strictObject({ cond: conditionSchema, difficulty: difficultySchema })).optional(),
  opposed: z
    .strictObject({
      attacker: charKeySchema,
      attackerSkill: z.string().optional(),
      attackerLabel: z.string().optional(),
      bonusSL: z.number().optional(),
      attackerBonusSL: z.number().optional(),
    })
    .optional(),
});

/** `EffectOp` (`engine/flowCore.ts:45`) — feuille `do` par défaut de `Flow<E>`. `on` = les 4 valeurs de
 *  l'interface TS : `'party'`/`'hero'` (scène) ou `'caster'`/`'target'` (contexte d'incantation). Le
 *  ciblage `'self'`/`'victim'` est le vocabulaire du NIVEAU TRIGGER (`effectTargetingSchema`), pas de la
 *  feuille : sur la feuille, `'caster'` = porteur, `'target'` = cible résolue par le trigger. */
export const effectOpSchema = z.strictObject({
  type: z.literal('ops'),
  ops: z.array(gameOpSchema),
  on: z.enum(['party', 'hero', 'caster', 'target']).optional(),
  heroId: z.string().optional(),
  untilTime: z.number().optional(),
  label: z.string().optional(),
});

/** `Flow<EffectOp>` (`engine/flowCore.ts:426`) — arbre récursif ACYCLIQUE (seq/do/if/test/choice). */
export const flowSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('seq'), steps: z.array(flowSchema) }),
    z.strictObject({ kind: z.literal('do'), effect: effectOpSchema }),
    z.strictObject({ kind: z.literal('if'), cond: conditionSchema, then: flowSchema, else: flowSchema.optional() }),
    z.strictObject({ kind: z.literal('test'), test: flowTestSchema, success: flowSchema, fail: flowSchema }),
    z.strictObject({
      kind: z.literal('choice'),
      prompt: z.string(),
      cost: z.strictObject({ advantage: z.number() }).optional(),
      icon: z.string().optional(),
      yes: flowSchema,
      no: flowSchema.optional(),
    }),
  ]),
);

/** `EffectTargeting` (`engine/flowCore.ts:469`). */
export const effectTargetingSchema = z.union([
  z.enum(['self', 'victim', 'engaged', 'grappled']),
  z.strictObject({ near: z.enum(['victim', 'self']), radiusMeters: z.number() }),
  z.strictObject({ pick: z.literal('engaged'), sizeAtMost: z.literal('self').optional(), max: z.number() }),
]);

/** `TriggeredEffect<EffectOp>` (`engine/flowCore.ts:472`). `optional` (Contrôle de la Frénésie…)
 *  seule 1/9 des JSON le peuple (`talents.json`) — laissé optionnel, sans risque pour les autres. */
export const triggeredEffectSchema = z.strictObject({
  trigger: z.enum([
    'onHit', 'onCrit', 'onWoundLoss', 'onSlain', 'onRoundStart', 'onStartled', 'onKill', 'onCharged', 'onGainCondition',
    'onCombatStart', 'onCombatEnd', 'onRoundEnd', 'onTurnStart', 'onTurnEnd',
    'onAttackResolved', 'onCastResolved', 'onMiscast', 'onOwnTestFailed',
  ]),
  on: effectTargetingSchema,
  flow: flowSchema,
  condition: z.string().optional(),
  attackType: z.enum(['melee', 'ranged']).optional(),
  optional: z.boolean().optional(),
});

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
    z.strictObject({ times: z.strictObject({ of: formulaSchema, factor: z.number() }) }),
  ]),
);

/** `StageOutcome` (`src/engine/activities.ts:82-84`) — effet de portée Étape (Activités + Rencontres
 *  de voyage). Dupliqué à l'identique dans `activities`/`incidents-monture`/`problemes-vehicule`/
 *  `rencontres-edoc`. */
export const stageOutcomeSchema = z.enum([
  'suppressExposure', 'gatherInfo', 'noSurprise', 'mapMade', 'rerollToken', 'countsAsRest', 'campCare',
  'extraActivity', 'skipStage', 'fullRecovery', 'worsenWeather',
]);

/** `TravelTableEntry` (`src/engine/travelTables.ts:15-26`) — entrée d100 de l'enveloppe `TravelTable`,
 *  partagée par `rencontres-edoc`/`incidents-monture`/`problemes-vehicule`. */
export const travelTableEntrySchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  label: z.string(),
  text: z.string(),
  stageOutcome: stageOutcomeSchema.optional(),
  vehicleWounds: z.string().nullable().optional(),
  occupantOps: z.array(gameOpSchema).optional(),
});

/** `ShipCrewTest` (`src/data/shipCriticals.ts`) — Test d'équipage déclenché par un Critique de coque. */
export const shipCrewTestSchema = z.strictObject({
  skillId: z.string().optional(),
  difficulty: difficultySchema.optional(),
  crewTarget: z.enum(['poste', 'deck']).optional(),
  onFail: z.array(gameOpSchema),
});

/** `ShipCritEntry` (`src/data/shipCriticals.ts`) — entrée d100 de Critique de coque, partagée par
 *  `ship-criticals` (navale) et `river-criticals` (fluviale). */
export const shipCritEntrySchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  name: z.string(),
  ops: z.array(gameOpSchema).optional(),
  shrapnel: z.number().optional(),
  hullCrits: z.string().optional(),
  crewTest: shipCrewTestSchema.optional(),
  note: z.string(),
});
