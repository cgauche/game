/**
 * Schéma de `spells.json` — dérivé de l'inventaire COMPLET des clés (script node, n=416/416), de
 * `SpellData` (`src/data/index.ts:983`), `SpellRange`/`SpellTarget` (`src/engine/spellRange.ts:16-36`),
 * `SpellDuration` (`src/engine/spellDuration.ts:13-18`) et `Formula` (`src/engine/ops.ts:65-84`).
 * `effects` (`Flow<EffectOp>`) : MÊME algèbre que talents/etats (`engine/flowCore.ts`), PROMUE dans
 * `common.ts` (`flowSchema`/`conditionSchema`/`formulaSchema`).
 */
import { z } from 'zod';
import { sourceRefSchema, secondarySourceRefSchema, charKeySchema, flowSchema, formulaSchema, conditionSchema, variantOf } from '../common';

export const file = 'spells.json';

/** `SpellRange` (`engine/spellRange.ts:16`). */
const spellRangeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('touch') }),
  z.strictObject({ kind: z.literal('distance'), value: formulaSchema, unit: z.enum(['m', 'km']) }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellTarget` (`engine/spellRange.ts:31`). `maison` : valeur maison ÉDITABLE portant sa
 *  justification, quand le RAW laisse un point ouvert — CLAUDE.md règle 7. */
const spellTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('self') }),
  z.strictObject({ kind: z.literal('count'), n: formulaSchema }),
  z.strictObject({ kind: z.literal('area'), span: z.enum(['radius', 'diameter']), meters: formulaSchema, excludesCaster: z.boolean().optional(), affects: conditionSchema.optional(), maison: z.string().optional() }),
  z.strictObject({ kind: z.literal('cone'), lengthMeters: formulaSchema, widthMeters: formulaSchema, affects: conditionSchema.optional(), maison: z.string().optional() }),
  z.strictObject({ kind: z.literal('special'), text: z.string() }),
]);

/** `SpellDuration` (`engine/spellDuration.ts:13`). */
const spellDurationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('instant') }),
  z.strictObject({ kind: z.literal('rounds'), value: formulaSchema, plus: z.literal(true).optional() }),
  z.strictObject({ kind: z.literal('clock'), value: formulaSchema, unit: z.enum(['minutes', 'hours', 'days']) }),
  z.strictObject({ kind: z.literal('untilDawn') }),
  z.strictObject({ kind: z.literal('special'), text: z.string(), plus: z.literal(true).optional() }),
]);

/**
 * ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — les rubriques qu'un Rituel imprime EN PLUS d'un Sort.
 * `NI` (`l.379`) et `Description` (`l.393`) n'en sont pas : ce sont `cn` et `desc`, communs à tout
 * Sort puisqu'un Rituel EST un Sort (`l.363`).
 *
 * Chaque champ admis ici a un CONSOMMATEUR (même règle que `VARIANT_RESOLVED_FIELDS` ci-dessous) :
 * la fiche Codex des Sorts (`src/ui/compendium/registry.ts`, catégorie `spells`) rend `xp`/`cnFrom`
 * en faits d'en-tête et les quatre rubriques de prose en section « Rituel ». Les formes qu'aucun
 * consommateur ne lit (ops de sacrifice/conséquence, Tests de condition, modificateurs de NI portés
 * par le Rituel lui-même) sont HORS de ce schéma tant qu'un lecteur ne les exerce pas.
 */
const ritualSchema = z.strictObject({
  /** Rubrique **Type** (`l.381`) VERBATIM — l'énoncé imprimé de qui peut y prendre part. */
  type: z.string(),
  /** Le même **Type** en ids de `domains.json`, part EXÉCUTABLE de la rubrique (`l.381` : « Un
   *  lanceur de sorts qui ne pratique pas l'un des Domaines listés ne peut pas y prendre part »),
   *  lue par `arcaneDomainsOf`/`eligibleTalent` (`src/engine/grimoire.ts`). REQUISE — aucun Rituel
   *  n'est dispensé de dire ses Domaines, et « plusieurs Domaines » n'est JAMAIS représenté par
   *  « aucun ». Deux états :
   *   - liste PEUPLÉE = seuls ces Domaines ; un Rituel ouvert à trois reste interdit au quatrième ;
   *   - liste VIDE = « N'importe quel Domaine », aucune exclusion.
   *  Une rubrique qui désigne une CATÉGORIE (« N'importe quel Domaine sombre », `VDM 02 l.414`) se
   *  résout par la liste que le livre en donne — ici les deux Domaines du chapitre de Magie noire
   *  du Livre de base (`LDB 50`, cf. `LDB 47 l.309`). */
  domains: z.array(z.string()),
  /** Rubrique **NI** (`l.379`) lorsqu'elle n'imprime PAS un nombre mais une formule sur la CIBLE
   *  (« Force Mentale du démon ») : `cn` reste `null`, et la fiche Codex affiche ce texte au lieu
   *  d'un NI muet. VERBATIM. */
  cnFrom: z.string().optional(),
  /** Rubrique **PX d'apprentissage** (`l.383`). */
  xp: z.number(),
  /** DIFFICULTÉ RÉDUITE imprimée entre parenthèses (`VDM 02 l.398` : « **NI :** 50 (25) », `l.400` :
   *  « **PX d'apprentissage :** 200 (100) »), dont la rubrique `type` nomme les bénéficiaires. La
   *  clause porte sur le LANCEUR (les Domaines qu'il PRATIQUE), pas sur le Rituel — d'où ces ids
   *  ici et non un `CastingNumberMod`, dont le `CastingNumberSubject.domainId` est le Domaine du
   *  SORT (`src/engine/castingNumber.ts:76`). Lue par `ritualReduction` (`src/engine/grimoire.ts`),
   *  consommée par `spellCost` (PX) et `castingNumberOf` (`src/engine/magic.ts`, NI de base). */
  reduced: z.strictObject({
    /** Ids de `domains.json` dont la pratique ouvre la valeur réduite. */
    domains: z.array(z.string()),
    /** Le Talent Magie du Chaos y ouvre aussi — `domains.json` ne porte pas le Chaos (c'est une
     *  `family`), il se lit donc sur le lanceur comme pour `CastingNumberScope.chaosMagic`. */
    chaosMagic: z.literal(true).optional(),
    cn: z.number(),
    xp: z.number(),
  }).optional(),
  /** Rubrique **Composants** (`l.385`) VERBATIM. */
  components: z.string(),
  /** Rubrique **Conditions** (`l.387`) VERBATIM. */
  conditions: z.string(),
  /** Rubrique **Sacrifices** (`l.389`) VERBATIM. */
  sacrifices: z.string(),
  /** Rubrique **Conséquences** (`l.391`) VERBATIM. */
  consequences: z.string(),
});

// ── SpellData (src/data/index.ts:983) ───────────────────────────────────────────────────────────
/** Entrée de `spells.json`. */
const spellEntrySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Libellé d'affichage du type (« Béni », « Magie mineure »… 17 valeurs constatées, PROSE — le
   *  discriminant de logique est `family`). */
  type: z.string(),
  subType: z.string().nullable(),
  domainId: z.string().optional(),
  /** `VDM 02 l.363` / `l.377-393` — TAG lu par `castingNumberOf` (`src/engine/magic.ts:483`) et
   *  `effectiveSpellOf` (`src/state/combatFlow.ts:3739`) pour composer un `CastingNumberSubject`
   *  dont le `kind` départage les portées `kinds:['sort'|'rituel']` (`VDM 12 l.646-647`,
   *  `VDM 14 l.489`). Sans ce champ au schéma, aucune donnée ne peut porter la nature Rituel. */
  isRitual: z.boolean().optional(),
  /** Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — présentes sur les seules entrées
   *  taguées `isRitual`. */
  ritual: ritualSchema.optional(),
  family: z.enum(['mineure', 'arcane', 'invocation', 'beni', 'chaos']),
  cn: z.number().nullable(),
  range: spellRangeSchema.nullable(),
  target: spellTargetSchema.nullable(),
  duration: spellDurationSchema.nullable(),
  desc: z.string(),
  missile: z.boolean().optional(),
  damage: z.number().optional(),
  ignorePA: z.boolean().optional(),
  ignoreBE: z.boolean().optional(),
  curated: z.boolean().optional(),
  breathAttack: z.literal(true).optional(),
  opposed: z.strictObject({
    kind: z.enum(['resist', 'contact']),
    char: charKeySchema.optional(),
    skill: z.string().optional(),
  }).optional(),
  effects: flowSchema.optional(),
  source: sourceRefSchema,
  /** Emplacement SECONDAIRE (#563) — ex. `maitre-de-la-bete` prose folio 246 (ancre) ET stat-bloc
   *  (NI/Portée/Cible/Durée) folio 245 (`alsoIn[0].quote`). */
  alsoIn: z.array(secondarySourceRefSchema).optional(),
});

/**
 * Champs qu'une variante réglée de `spells.json` peut republier — ceux dont la lecture PASSE par
 * `effectiveEntry` (`src/engine/variants.ts`), preuve par consommateur :
 *  - `desc`/`source` → fiche Codex `src/ui/compendium/registry.ts:1371` (bâtie sur `effectiveEntry`,
 *    `registry.ts:1370`)
 *  - `cn` → NI effectif `castingNumberOf` (`src/engine/magic.ts:486`), lu par `evaluateCasting`
 *    (`magic.ts:596`) et `castLandProbability` (`magic.ts:561`) ; aperçu pré-jet `previewCast`
 *    (`src/state/combatFlow.ts:844`) ; NI de lecture au grimoire `effectiveSpellOf`
 *    (`src/state/combatFlow.ts:3740`) ; « NI » affiché de la fiche Codex (`registry.ts:1373`)
 *  - `duration` → `durationClockMinutes` (`src/state/combatFlow.ts:4105`), durée de la zone posée
 *    par `placeSpellZone` (`src/state/combatFlow.ts:4304`)
 *  - `effects` → `spellFlowFor` (`src/state/combatFlow.ts:4122`), `spellOps`
 *    (`src/state/combatEffects.ts:1463`)
 * `range`/`target`/`missile`/`damage`/`ignorePA`/`ignoreBE`/`opposed` en sont ABSENTS : aucune
 * variante curée ne les republie, et une liste blanche n'admet un champ qu'au moment où une donnée
 * réelle l'exerce.
 */
export const VARIANT_RESOLVED_FIELDS = ['desc', 'source', 'cn', 'duration', 'effects'] as const;

export const schema = z.array(
  spellEntrySchema.extend({
    /** Variantes réglées (#563/#564) : patch PARTIEL de l'entrée sur `VARIANT_RESOLVED_FIELDS`,
     *  résolu par `effectiveEntry` (`engine/variants.ts`, REPLACE par champ déclaré) — SEULE lecture
     *  des consommateurs. Les 18 sorts que VDM révise sont gatés par `magic-vdm-incantation`. */
    variants: z.array(variantOf(spellEntrySchema, VARIANT_RESOLVED_FIELDS)).optional(),
  }),
);
