/**
 * SEAM DE JET UNIQUE (#275) — LA porte déclarative de tout dé du jeu : le call-site DÉCRIT, la porte
 * décide du surfaçage. Extension de la fabrique existante (`makeRollFlow`/`FLOWS`,
 * `rollFlowFactory.ts`) + `cascade.ts` (séquenceur) — RIEN de parallèle.
 *
 * `openRoll` DÉCRIT un jet (`RollRequest`) et une CONTINUATION enregistrée par `kind`
 * (`registerCascadeApplier`, `cascade.ts:57`) ; la porte RÉSOUT la policy `klass × contrôleur ×
 * cadence` (Décision 3) via les prédicats EXISTANTS (`humanControlled`/`pilotedByHuman`/`cadenceAuto`/
 * `seaAutoResolves`) et choisit la surface :
 *   M = modale influençable (`startCascade`, propriétaire = l'acteur humain) ;
 *   V = étape visible-lançable MJ (`startCascade`, propriétaire = le siège `gmSeat` — un `actorId`
 *       d'ennemi EN BATAILLE via `seatOwns` (`netOwnership.ts:19`), un côté `worldSide` sans acteur via
 *       le marqueur `CascadeStep.worldOwner` + le sentinel `WORLD_STEP_OWNER` (`pendings.ts`), Ronde 1) ;
 *   I = inline-PV (`runCascadeImmediate`, aucune influence, conséquence appliquée d'office).
 * Consommé (mesure du 2026-08-04) par SIX flux : `innFlow`, `landMarketFlow`, `merchantFlow`,
 * `portFlow`, `seaVoyageFlow`, `tavernFlow`. Les autres flux hors-combat — activités d'interlude,
 * entretien, voyage terrestre et fluvial — n'appellent PAS la porte : leur population est inventoriée
 * dans `docs/registre-jets.md` (#1066). La garde d'exclusivité `roll-seam-exclusivity-guard.test.ts`
 * (#274) verrouille l'usage.
 *
 * ÉCARTS documentés vs le doc de conception (justifiés, à réconcilier aux rondes suivantes) :
 *  1. **`worldSide` → propriétaire MJ.** FERMÉ Ronde 1 : `buildMonoStep` marque `worldOwner:true` sur
 *     une étape `worldSide` sans `actorId` ; `modalArbiter.ts` (entrée `cascade`) route ce marqueur vers
 *     le sentinel `WORLD_STEP_OWNER`, que `netOwnership.seatOwns` résout au siège `gmSeat` (existant) ou
 *     à l'hôte (sinon) — couture la PLUS PETITE (aucune extension d'`intentAllowedFor`, le repli
 *     générique `seatOwns(s, seat, owner)` suffit déjà). `batch` (agrégat, pas de `worldOwner`) reste
 *     hors de cet écart — cf. 2.
 *  2. **`batch` utilise `CascadeStep.participants`.** FERMÉ Ronde 2 cran 2, DÉ-NAVALISÉ Ronde batch
 *     (#328) : `buildBatchStep` pose une étape À PARTICIPANTS GÉNÉRIQUES (`BatchParticipant`, flux
 *     `cascadeBatch`) — l'AGRÉGAT (`step.aggregate`) est calculé GÉNÉRIQUEMENT par
 *     `cascade.aggregateBatchStep` à la VALIDATION, kind-agnostique du nombre de contributeurs. Les
 *     paramètres de formule que `RollRequest` ne porte pas (Moral, Manque de bras, sabotage) transitent
 *     DÉJÀ CHIFFRÉS par le flux propriétaire via `meta` NEUTRE (`aggregateFlatDR`/`aggregateCapTo`/
 *     `aggregateOpposeSl`, `CascadeStepMeta`) ; par défaut 0/absent.
 */
import type { Get, Set } from './flowTypes';
import type { Combatant, CharKey, Difficulty, Weapon } from '../engine/types';
import { DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../engine/types';
import type { PairedSense, GameOp } from '../engine/ops';
import type { CascadeStep, CascadeStepMeta, BatchParticipant, CascadeAggregate } from './pendings';
import type { RecapLine, RecapTone } from './recapLine';
import type { ModLine } from '../engine/combat';
import { combatBaseValue, combatValueModParts, conditionModLines, combatCharKey, combineMods } from '../engine/combat';
import { volatileCharLines } from '../engine/characteristics';
import { RULE_REF } from '../engine/ruleRefs';
import { TestOutcome } from '../engine/testOutcome';
import { actorIn } from './combatants';
import { startCascade, runCascadeImmediate } from './cascade';
import { testValue, partyBest, partyAssisted, testValueSplit, testValueParts, skillBaseValue, supportSplit, type SupportDetail } from '../engine/skills';
import { testStatePenaltyParts, testStatePenalty } from '../engine/conditions';
import { humanControlled, pilotedByHuman } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { seaAutoResolves } from './voyageCadence';
import { findSkillById, conditionLabel, type StakeRef } from '../data';
import { t, type OutKey, type OutVars } from '../i18n';
import { rollTest, clampTarget, exactDifficultyFromModifier } from '../engine/tests';
import { defaultRNG, type RNG } from '../engine/dice';
import type { TestResult } from '../engine/tests';

/** Les 4 classes déclaratives (mandat #275). Pilotent la POLICY, jamais le call-site. */
export type RollClass = 'hero-test' | 'enemy' | 'subi' | 'batch';

/** Agrégation d'un jet multi (porte/contresort/équipage) — SEULE variation de la famille multi.
 *  Canonique dans `pendings.ts` (`CascadeAggregate`, ré-exportée ici pour compat des call-sites du
 *  seam) : `CascadeStep.participants` (Décision 4 cran 1) porte la MÊME union. */
export type RollAggregate = CascadeAggregate;

/** DESCRIPTION déclarative d'un jet. Le call-site remplit ceci et RIEN d'autre. */
export interface RollRequest {
  /** Le côté qui teste : un acteur DÉJÀ désigné (héros/PNJ), le MEILLEUR PJ du groupe pour une
   *  compétence/carac (« le plus qualifié tente », résolu ICI via `partyAssisted`/`partyBest` —
   *  jamais recalculé au call-site), le siège MONDE (ennemi/subi sans acteur), ou des participants (batch). */
  side:
    | { actorId: string }
    | { partyBest: { skill?: string; char?: CharKey; assisted?: boolean } }
    | { worldSide: 'enemy' | 'world'; ownerId?: string }
    | { participants: BatchParticipant[]; ownerId?: string };
  /** Le NOM DE L'ACTION SEUL (« Forcer le rythme », « Prière », « Désertion »…) — CHAMP STRUCTURÉ
   *  DISTINCT de `test` (fix de classe #352 : l'ancien `test.label` texte-libre pouvait se confondre
   *  avec la compétence). Rendu UNIQUEMENT en position de TITRE (`rollTitle`) — jamais recomposé avec
   *  le nom de l'acteur/la compétence/la difficulté au call-site. */
  actionLabel: string;
  /** Le TEST déclaré — SEULE source des ids compétence/carac (réf structurée, passe telle quelle à
   *  `testValue`). AUCUN champ de texte ici : le libellé de compétence affiché est TOUJOURS DÉRIVÉ de
   *  `skill`/`char` par `testSkillLabel` (catalogue `findSkillById`/`CHAR_LABELS`) — insurchargeable,
   *  un call-site ne peut plus injecter de texte en position de compétence. */
  /** `noSupport` : Test de résistance (maladie/poison/peur/danger…) — coupe le Soutien du côté
   *  `partyBest` (LDB 12 l.197), pour éviter qu'un futur appelant câble un Soutien interdit. */
  test: { skill?: string; char?: CharKey; spec?: string; sense?: PairedSense; menace?: string; noSupport?: boolean };
  difficulty: Difficulty;
  klass: RollClass;
  /** Requis pour un `batch`/multi ; défaut `summed-dr` (Test d'équipage, MDG 14). */
  aggregate?: RollAggregate;
  /** ENJEU du jet (#1117) — RÉFÉRENCE de donnée produite par une porte d'enjeu (`combatStakeRef`,
   *  `nightStakeRef`, `voyageStakeRef`…), jamais un texte : la porte du seam la POSE telle quelle sur
   *  l'étape qu'elle construit (mono comme batch). C'est ici que le flux appelant dit ce qu'il met en
   *  jeu — `buildMonoStep` est générique et n'a aucun moyen de le deviner. */
  stake?: StakeRef;
}

/** Trois surfaces (Décision 3) : Modale influençable / Visible-lançable MJ / Inline-PV. */
type Surface = 'M' | 'V' | 'I';

/** Cible EFFECTIVE d'un Test skill/char AVEC l'écrêtage RÉELLEMENT subi — même arithmétique que
 *  `rollTest`, par la primitive PARTAGÉE `clampTarget` (`engine/tests.ts`, plus de `clamp` recopié
 *  ici). L'écrêtage est RENDU, pas jeté : une base SOUTENUE peut franchir le plafond, et l'écart
 *  doit se NOMMER sur la ligne (« plafond 99 ») au lieu d'être avoué « autres » (#1117).
 *  `baseOverride` couvre les côtés SANS acteur (`worldSide` — via `meta.baseValue`) ou dont la valeur
 *  EST l'acteur+valeur choisis par la porte (`partyBest`) — RÉSERVÉ à ces deux cas (extension mandat
 *  coordinateur) : un côté `actorId` calcule TOUJOURS `testValue` ICI, jamais un `meta.baseValue`. */
export function effectiveTargetClamped(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): { target: number; clamped?: number } {
  const value = baseOverride ?? (actor ? testValue(actor, test.skill, test.char, test.spec, test.sense) : 0);
  return clampTarget(value + DIFFICULTY_MODIFIERS[difficulty]);
}

/** Cible EFFECTIVE seule — pour les sites dont la base ne peut pas franchir les bornes. */
export function effectiveTarget(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): number {
  return effectiveTargetClamped(actor, test, difficulty, baseOverride).target;
}

/** Libellé de COMPÉTENCE/carac d'un Test DÉCLARÉ — DÉRIVÉ des ids `skill`/`char` (catalogue
 *  `findSkillById`/`CHAR_LABELS`) uniquement, jamais d'un texte libre : `RollRequest['test']` ne porte
 *  plus de champ texte (fix de classe #352), donc AUCUN call-site ne peut se substituer à cette
 *  dérivation. `undefined` si le Test ne porte ni compétence ni caractéristique (ex. Désertion —
 *  cible posée par `meta.baseValue`). */
export function testSkillLabel(test: RollRequest['test']): string | undefined {
  return test.skill ? (findSkillById(test.skill)?.label ?? test.skill) : test.char ? CHAR_LABELS[test.char] : undefined;
}

/** COMPOSE l'affichage détaillé d'une étape mono depuis les ids déclarés — SOURCE UNIQUE (mandat
 *  coordinateur) : plus un call-site n'assemble `${actor.name} — ${action} (${skill})` à la main.
 *  `action` = `req.actionLabel` (nom seul) ; le détail (compétence/carac) est omis si le Test ne porte
 *  ni compétence ni caractéristique. Position : `step.label` (sous-titre d'étape) — JAMAIS le titre de
 *  cascade (`rollTitle`, plus court, pas de duplication).
 *  La DIFFICULTÉ n'est PAS ici (#1072) : elle vit sur la LIGNE du jet (`CascadeStep.difficulty` →
 *  `RollLine`). L'écrire aussi dans ce sous-titre serait le double rendu de classe #352. */
export function composeRollLabel(actor: Combatant | undefined, action: string, test: RollRequest['test']): string {
  const detail = testSkillLabel(test);
  return `${actor ? `${actor.label} — ` : ''}${action}${detail ? ` (${detail})` : ''}`;
}

/**
 * TITRE d'un jet — SOURCE UNIQUE (#295 Lot 0, Décision 1a ; réduit au fix de classe #352). C'est
 * `req.actionLabel` SEUL — jamais recomposé avec acteur/compétence/difficulté : ce détail vit DÉJÀ
 * dans `step.label` (`buildMonoStep`, via `composeRollLabel`), rendu en SOUS-TITRE par `CascadeModal`.
 * Un titre composé comme `step.label` produirait un DOUBLE RENDU exact (#352 — bug rapporté : la même
 * ligne « Héros — Action (Compétence Difficulté) » deux fois dans la modale).
 */
export function rollTitle(get: Get, req: RollRequest): string {
  void get;
  return req.actionLabel;
}

/**
 * Conséquence d'une étape DÉJÀ appliquée (#295 Lot 0, Décision 1b) — soit un effet mécanique (`ops`,
 * montant RÉEL rendu depuis le `GameOp` appliqué), soit une note narrative (`say`, clé `out.*` SANS
 * placeholder de jet — cf. garde i18n `i18n.test.ts`). AUCUN accès à roll/target/sl/won : la
 * duplication d'outcome (`${roll}/${target}`, « réussi (DR X) ») est INEXPRIMABLE par construction.
 * `tone`/`icon` (#349) habillent l'affichage de la ligne — `RecapTone` = vocabulaire UNIQUE, celui de
 * `NightEntry.tone`/`RecapLine.tone` (`state/recapLine.ts`), jamais un second jeu de valeurs.
 */
export type Consequence =
  | { ops: GameOp[]; tone?: RecapTone }
  | { say: OutKey; vars?: OutVars; tone?: RecapTone; icon?: string };

/** Ligne d'un `GameOp` DÉJÀ appliqué — le montant est un LITTÉRAL résolu par l'applier (jamais une
 *  `Formula` à re-tirer ici : `resultLine` ne reçoit ni cible ni RNG, cf. Décision 1b). Étend au fil
 *  des Lots de migration (#295 Lot 1) — un `op` sans formatteur reste silencieux (`''`), jamais un crash. */
function opConsequenceLine(op: GameOp): string {
  switch (op.op) {
    case 'wounds': return typeof op.amount === 'number' && op.amount > 0 ? t('out.consWounds', { n: op.amount }) : '';
    case 'heal': return typeof op.amount === 'number' && op.amount > 0 ? t('out.consHeal', { n: op.amount }) : '';
    case 'condition': return typeof op.id === 'string' ? t('out.consCondition', { cond: conditionLabel(op.id) }) : '';
    default: return '';
  }
}

/** Ton PAR DÉFAUT d'une conséquence `ops` sans `tone` explicite — dérivé du GameOp lui-même (soin =
 *  positif, Blessures/État = négatif), jamais deviné au call-site. */
function defaultOpsTone(ops: GameOp[]): RecapTone {
  if (ops.some((o) => o.op === 'heal')) return 'ok';
  if (ops.some((o) => o.op === 'wounds' || o.op === 'condition')) return 'bad';
  return 'info';
}

/**
 * Rend la ou les conséquences d'une étape DÉJÀ dénouée en LIGNES STRUCTURÉES (#349) — LA forme
 * consommée par le renderer partagé (`ui/RecapLine.tsx`) : `CascadeStep.outcome`, `TravelRecapDay.
 * lines`. Une entrée VIDE (`text` vide) est filtrée — `cons` vide ⇒ `[]`.
 *
 * Le TON reste celui qui a été AUTHORÉ (#1078 LOT B2) : une conséquence `say` sans `tone` n'en reçoit
 * pas — dans le cadre d'issue d'une modale de jet, elle se rend donc à PLEINE couleur, comme les
 * lignes de `recapLineOfEvent`. L'atténuation (`tone: 'info'`) est une décision de site, jamais un
 * défaut technique. Une conséquence `ops`, elle, DÉRIVE son ton de l'op appliquée (soin/dégâts).
 */
export function resultLines(cons: Consequence[]): RecapLine[] {
  return cons
    .map((c): RecapLine => ('say' in c
      ? { text: t(c.say, c.vars), ...(c.tone ? { tone: c.tone } : {}), ...(c.icon ? { icon: c.icon } : {}) }
      : { text: c.ops.map(opConsequenceLine).filter(Boolean).join(' '), tone: c.tone ?? defaultOpsTone(c.ops) }))
    .filter((l) => l.text.length > 0);
}

/**
 * Rend la ou les conséquences d'une étape DÉJÀ dénouée EN UNE CHAÎNE — repli pour les ~100 call-sites
 * NON convertis au rendu structuré (journal texte, `get().log()`) : joint `resultLines` (#349, source
 * UNIQUE — ne recalcule rien). Le verdict ✓/✗ ±DR reste porté par la rangée de jet (`RollLine`) seule.
 */
export function resultLine(cons: Consequence[]): string {
  return resultLines(cons).map((l) => l.text).join(' ');
}

/** Une entrée `freeCons` : un texte SIMPLE (repli neutre) ou une ligne déjà TONÉE/ICÔNÉE (#349, dette
 *  1 — le flux DÉRIVE le ton depuis ce qu'il vient de résoudre, ex. `step.result.success`, au lieu de
 *  composer une chaîne muette). */
export type FreeConsLine = string | { text: string; tone?: RecapTone; icon?: string };

/** Enveloppe des lignes de conséquence DÉJÀ composées (sans roll/target/sl du jet visible) en
 *  `Consequence[]` (#295 Lot 1, `out.free` passthrough) — SOURCE UNIQUE, réutilisée par tous les
 *  appliers de cascade migrés (river/travel/sea/shipwreck/pursuit/combat/rest/embrigadement). */
export const freeCons = (texts: FreeConsLine[]): Consequence[] => texts
  .map((x): { text: string; tone?: RecapTone; icon?: string } => (typeof x === 'string' ? { text: x } : x))
  .filter((x) => x.text.length > 0)
  .map(({ text, tone, icon }) => ({ say: 'out.free' as OutKey, vars: { text }, tone, icon }));

/** Résout le côté d'un jet MONO (`hero-test`/`enemy`/`subi` non-`batch`) en acteur + éventuelle valeur
 *  DÉJÀ CALCULÉE (mandat coordinateur — le call-site ne calcule plus rien) :
 *   - `actorId` : l'acteur désigné, valeur = `testValue` (calculée par `effectiveTarget`, pas ici) ;
 *   - `partyBest` : le meilleur PJ du groupe pour la compétence/carac (`partyAssisted` par défaut —
 *     LDB 12, soutien — `assisted:false` pour `partyBest` nu), valeur DÉJÀ résolue (inclut le soutien) ;
 *   - `worldSide` : aucun acteur — `meta.baseValue` (seuil posé par le call-site, ex. désertion d100). */
function resolveMonoSide(get: Get, req: RollRequest, meta?: CascadeStepMeta): { actorId?: string; actor?: Combatant; baseValue?: number; support?: SupportDetail } {
  if ('actorId' in req.side) {
    return { actorId: req.side.actorId, actor: actorIn(get(), req.side.actorId) };
  }
  if ('partyBest' in req.side) {
    const { skill, char, assisted } = req.side.partyBest;
    // La SPÉCIALISATION et le SENS déclarés sur le Test entrent dans le choix du meneur ET dans sa
    // valeur : sans eux, `partyBest`/`partyAssisted` liraient une AUTRE instance de la compétence
    // (Métier (Charpentier) vs Métier (Serrurier)) et la valeur du meneur divergerait de celle que
    // `rollLine` décompose ensuite — la garde d'exactitude le refuserait, à raison.
    // `noSupport` (LDB 12 l.197) : Test de résistance déclaré sur le spec → jamais de Soutien, même si
    // `assisted` n'a pas été mis à `false` au call-site.
    if (assisted === false || req.test.noSupport) {
      const solo = partyBest(get().party, skill, char, undefined, req.test.spec, req.test.sense);
      return solo ? { actorId: solo.actor.id, actor: solo.actor, baseValue: solo.value } : {};
    }
    const picked = partyAssisted(get().party, skill, char, undefined, req.test.spec);
    if (!picked) return {};
    // Le DÉTAIL du Soutien remonte avec la valeur : la porte le pose sur l'étape (`buildMonoStep`),
    // la modale l'affiche en ligne de mod — un Soutien fondu sans détail est un bonus invisible.
    return { actorId: picked.actor.id, actor: picked.actor, baseValue: picked.value, support: picked.support };
  }
  return { baseValue: typeof meta?.baseValue === 'number' ? meta.baseValue : undefined };
}

/** Policy `klass × contrôleur × cadence` (Décision 3, table COMPLÈTE) — adossée aux prédicats
 *  EXISTANTS, jamais au `kind`. `autoC` (Rapide/Auto global) domine partout ; `autoV` (voyage COMMANDÉE
 *  + `kind` de routine, `seaAutoResolves`) route ensuite ; le reste dépend de la classe + du contrôle. */
/** EXPORTÉ pour les call-sites qui bâtissent une cascade à PLUSIEURS étapes `subi` d'un même geste
 *  (scorbut/épuisement — Résistance PAR héros, `seaVoyageFlow.ts`) : `CascadeStep.participants`
 *  (Décision 4, Ronde 2) n'existe pas encore, donc `openRoll` (mono/batch) ne peut pas porter N étapes
 *  indépendantes. La policy `subi` ne dépend PAS de `req.side` (cf. ci-dessous) → un seul appel avec un
 *  `side` `worldSide` de convenance donne la MÊME surface que N appels `openRoll` individuels — source
 *  UNIQUE de policy (jamais dupliquée), pas de nouveau chemin. */
export function resolveSurface(get: Get, req: RollRequest, kind: string): Surface {
  const s = get();
  const autoC = cadenceAuto();
  const autoV = seaAutoResolves(s.travelPlan?.orders, kind);
  const gmSeat = s.net.gmSeat ?? null;

  if (autoC) return 'I'; // « auto (autoC) → I partout » (Décision 3)

  if (req.klass === 'batch') {
    if (gmSeat != null) return 'V';
    if (autoV) return 'I';
    return 'M';
  }

  if (req.side && 'worldSide' in req.side) {
    // Ennemi/monde sans acteur unique : le MJ voit/lance (V) ; sans MJ, résolu en silence de fond (I).
    return gmSeat != null ? 'V' : 'I';
  }

  const actor = resolveMonoSide(get, req).actor;

  if (req.klass === 'enemy') {
    if (actor && pilotedByHuman(s, actor) && gmSeat != null) return 'V';
    return 'I';
  }

  if (req.klass === 'subi') {
    // « Subi » = jamais une décision du sujet → jamais M. Le MJ VOIT/LANCE (read-only) s'il est présent.
    return gmSeat != null ? 'V' : 'I';
  }

  // hero-test
  if (autoV) return 'I'; // routine de voyage COMMANDÉE (cf. batch)
  if (actor && humanControlled(s, actor)) return 'M';
  return 'I';
}

/** Ce qui est VRAI de tout jet : qui teste quoi, à quelle Difficulté, et ce qui pèse SUR LA CIBLE. */
interface RollLineBase {
  /** Le jeteur. Absent (côté MONDE : seuil d100 posé par l'appelant) ⇒ `valeur` tient lieu de base. */
  actor?: Combatant;
  /** Ids du Test — MÊME forme que `RollRequest['test']` (aucun texte : la ligne se NOMME depuis le catalogue). */
  test?: { skill?: string; char?: CharKey; spec?: string; sense?: PairedSense };
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS qui s'ajoutent À LA CIBLE et que la valeur ne contient PAS (dérive MSRC 7
   *  l.38, hors de contrôle l.41, −5 cumulatif du redressement l.40, km déjà au pas de course EDOC 7
   *  l.229). Les déclarer ici les compte UNE fois — dans la cible et sur la ligne. */
  surLaCible?: ModLine[];
  /** PLAFONNEMENT des `surLaCible` (`LDB 14 l.91-96`) : le monteur combine lui-même les
   *  modificateurs (`combineMods`, plafonds data-driven `combat-diff-cap-bonus`/`-malus`, appliqués
   *  aux seules `famille: 'circonstance'`) et, quand la combinaison diffère de la somme brute, ÉMET
   *  l'écart en ligne NOMMÉE « plafond Difficultés » liée à sa fiche de règle. Sans ce mode, un
   *  appelant qui plafonnait sa cible à la main laissait l'amputation en chip « autres ». Réservé aux
   *  jets de COMBAT : hors combat, la table de Difficulté n'a pas de plafond de combinaison. */
  plafond?: 'difficultes';
}

/**
 * CANAL de valeur d'un jet de COMBAT (#1153 L1a) — le combat ne se calcule pas avec `testValue` :
 *  - `'melee'`/`'ranged'` : valeur d'ATTAQUE/de tir — base `combatBaseValue` (`engine/combat.ts`,
 *    Caractéristique + Spé du Groupe de l'arme) et composantes `combatValueModParts` ;
 *  - `'test'` : Test de combat NON-attaque (gate d'Action, Résistance de fin de rencontre) — base
 *    `rawCombatTestBase` (`engine/skills.ts` : `testValue` privée de la pénalité d'États HORS combat)
 *    et pénalité d'États en version COMBAT (`conditionModLines` → `combatTestPenaltyParts`), comptée
 *    une seule fois. Le contrat des deux grandeurs est celui du moteur, pas de ce monteur.
 *
 * BRANCHÉ à `volatileCharLines` (`engine/characteristics.ts:68`) sur `'melee'`/`'ranged'` (#1153 L3a) :
 * ces lignes décomposent l'intérieur de la CARACTÉRISTIQUE (`effectiveChar`), donc de la valeur NUE.
 * Le canal les SORT de la base autant qu'il les pose en lignes — la valeur de combat et la cible
 * restent identiques au point près, seule la répartition base/chips change.
 */
export type RollLineCombat = { kind: 'melee' | 'ranged'; weapon?: Weapon } | { kind: 'test'; weapon?: never };

/** LA valeur du jet — trois régimes EXCLUSIFS, et le compilateur tient l'exclusion :
 *  - DÉRIVÉE de l'acteur (`testValue`) : rien d'autre à déclarer ;
 *  - DÉRIVÉE du COMBAT (`combat`) : la valeur suit le canal, l'appelant peut la fournir FONDUE
 *    (`valeur`, ex. Soutien des servants d'une pièce) — l'oracle du canal vérifie qu'elle s'y réduit ;
 *  - FOURNIE par l'appelant (`valeur`) : alors, et alors seulement, il peut dire ce qu'il a fondu
 *    dedans (`soutien`, `dansLaValeur`) ou DÉCLARER une valeur d'une AUTRE formule (`valeurEtrangere`).
 *  Un `soutien` sans `valeur` est INEXPRIMABLE : le Soutien n'existe que fondu dans une valeur. */
type RollLineValeur =
  | {
    /** Valeur FONDUE dont la cible dérive : valeur SOUTENUE de `partyAssisted`, seuil `meta.baseValue`. */
    valeur: number;
    /** Détail du Soutien (LDB 12) DÉJÀ fondu dans `valeur` — il ressort en ligne NOMMÉE. */
    soutien?: SupportDetail;
    /** Parts que l'appelant a lui-même fondues dans `valeur` et qu'il NOMME (−10 du réparateur de
     *  substitution `MSRC 5 l.113-117`) : elles SORTENT de la base pour prendre leur place de ligne.
     *  Les déclarer sans les avoir fondues fausse la base — la garde d'exactitude le refuse. */
    dansLaValeur?: ModLine[];
    /** La valeur vient d'une AUTRE formule que `testValue` (soigneur PNJ sans fiche, seuil de table) :
     *  la décomposition est alors IMPOSSIBLE et le drapeau la DÉCLARE — la base rendue n'est PAS un
     *  Niveau de Compétence. Sans lui, une reconstruction ratée est un BUG. Une valeur de COMBAT ne
     *  relève PLUS de ce drapeau : elle a son canal (`combat`). */
    valeurEtrangere?: true;
    combat?: never;
  }
  | {
    /** Canal COMBAT : la base et les composantes viennent des jumelles de `engine/combat.ts`. */
    combat: RollLineCombat;
    /** Valeur de combat DÉJÀ fondue par l'appelant (Soutien des servants) — omise, elle est dérivée. */
    valeur?: number;
    soutien?: SupportDetail;
    dansLaValeur?: ModLine[];
    valeurEtrangere?: never;
  }
  | { valeur?: never; soutien?: never; dansLaValeur?: never; valeurEtrangere?: never; combat?: never };

/** DÉCLARATION d'une ligne de jet — le CONTRAT d'entrée du monteur canonique `rollLine`. Aucun calcul
 *  chez l'appelant : il DIT l'acteur, le Test, la Difficulté, sa valeur et ses poches. */
export type RollLineSpec = RollLineBase & RollLineValeur;

/** MÊME déclaration, Difficulté EXCEPTÉE — pour les résolveurs qui savent QUI teste QUOI mais pas
 *  encore à quelle Difficulté (le meilleur réparateur de bateau, le meneur d'une enquête) : la
 *  Difficulté vient du SITE qui ouvre le jet. Se complète par `withDifficulty`. */
export type RollLineDecl = Omit<RollLineBase, 'difficulty'> & RollLineValeur;

/** Complète une déclaration par sa Difficulté. Générique : la branche EXACTE de l'union (valeur
 *  fournie / valeur dérivée) est CONSERVÉE, donc l'exclusivité `soutien` ⇒ `valeur` reste vérifiée
 *  par le compilateur après composition. */
export function withDifficulty<T extends RollLineDecl>(decl: T, difficulty: Difficulty): T & { difficulty: Difficulty } {
  return { ...decl, difficulty };
}

/** Ce qu'une étape-jet doit porter pour être lisible : base NUE, lignes NOMMÉES, cible, écrêtage —
 *  et, en mode plafonné, le PALIER de Difficulté que la combinaison des circonstances compose. */
export interface RollLineParts {
  base: number;
  mods: ModLine[];
  target: number;
  clamped?: number;
  /** Difficulté à AFFICHER : le palier DÉRIVÉ quand la combinaison des circonstances en compose un
   *  exactement (`LDB 14 l.91-96`), la Difficulté déclarée sinon. */
  difficulty: Difficulty;
  /** Composition du palier DÉRIVÉ (les lignes `famille:'circonstance'` + l'écart du plafond) : elles
   *  ne sont PLUS dans `mods` — le palier les porte, son popover les détaille. Absente = palier
   *  déclaré, tous les modificateurs restent en chips. */
  difficultyParts?: ModLine[];
}

/** Composantes de `testValue` HORS pénalité d'États : `testValueParts` les NOMME EN TÊTE (il ouvre sur
 *  `testStatePenaltyParts`, `engine/skills.ts`) — un Test de COMBAT leur substitue `conditionModLines`.
 *  Le découpage positionnel est VÉRIFIÉ par l'oracle du canal (`rawCombatTestBase`), jamais supposé. */
function partsHorsEtats(actor: Combatant, t: RollLineBase['test'] = {}): ModLine[] {
  const etats = testStatePenaltyParts(actor, t.skill).filter((p) => p.value !== 0).length;
  return testValueParts(actor, t.skill, t.char, t.spec, t.sense).slice(etats);
}

/** DÉFAIT une valeur de COMBAT en base NUE + composantes NOMMÉES — jumeau de `testValueSplit` pour le
 *  canal `combat` : même contrat (`base + Σ mods === valeur`, `exact` DIT si la reconstruction a tenu),
 *  autres jumelles moteur. L'ORACLE est la valeur que le canal SAIT produire (`combatBaseValue + Σ
 *  combatValueModParts`, ou `rawCombatTestBase`) : une `valeur` fournie qui ne s'y réduit pas — au
 *  Soutien et au `fused` déclarés près — est refusée, exactement comme hors combat.
 *  Les lignes volatiles de la CARACTÉRISTIQUE (`volatileCharLines` : Bénédiction de Bataille,
 *  séquelle « Fracture −30 ») vivent DANS `combatBaseValue` via `effectiveChar` : le canal les
 *  RETIRE de la base à mesure qu'il les pose en lignes, jamais l'un sans l'autre. */
function combatValueSplit(
  actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test'],
  value: number, support?: SupportDetail, fused = 0,
): { base: number; mods: ModLine[]; exact: boolean } {
  const sup = supportSplit(value, support);
  if (!actor) return { ...sup, exact: true };
  const charLines = canal.kind === 'test' ? [] : volatileCharLines(actor, combatCharKey(canal.kind, canal.weapon));
  const nue = canal.kind === 'test'
    ? skillBaseValue(actor, t?.skill, t?.spec, t?.char)
    : combatBaseValue(actor, canal.kind, canal.weapon) - charLines.reduce((s, l) => s + l.value, 0);
  const parts = canal.kind === 'test'
    ? [...partsHorsEtats(actor, t), ...conditionModLines(actor)]
    : [...charLines, ...combatValueModParts(actor, canal.kind, canal.weapon)];
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (nue + sum + fused !== sup.base) return { ...sup, exact: false };
  return { base: sup.base - sum, mods: [...sup.mods, ...parts], exact: true };
}

/** Valeur DÉRIVÉE d'un canal de combat quand l'appelant n'en fournit aucune. */
function combatChannelValue(actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test']): number {
  if (!actor) return 0;
  // `sense` transite des DEUX côtés (ici comme dans `partsHorsEtats`) : `rawCombatTestBase` ne le
  // prend pas, donc la valeur dérivée est composée à la main sur la MÊME formule (`testValue` privée
  // de la pénalité d'États hors combat). Sans cela, un Test de combat sense-scopé (Surdité, LDB 18)
  // verrait sa valeur et ses composantes diverger, et l'oracle THROW sur un site pourtant correct.
  return canal.kind === 'test'
    ? testValue(actor, t?.skill, t?.char, t?.spec, t?.sense) - testStatePenalty(actor, t?.skill)
      + conditionModLines(actor).reduce((s, m) => s + m.value, 0)
    : combatBaseValue(actor, canal.kind, canal.weapon) + combatValueModParts(actor, canal.kind, canal.weapon).reduce((s, m) => s + m.value, 0);
}

/**
 * MONTEUR CANONIQUE d'une ligne de jet (#1153) — le SEUL endroit du jeu où `base`/`mods`/`target`
 * d'une étape se calculent. La porte du seam (`buildMonoStep`) comme les monteurs LOCAUX des flux
 * (voyage fluvial/maritime/terrestre, embrigadement, activités hors combat) le consomment : un
 * call-site DÉCLARE, il ne calcule plus — une erreur de cette famille se corrige ICI, une fois.
 *
 * INVARIANTS :
 *  - `base` = Niveau de Compétence NU (`skillBaseValue`, `LDB 09 l.17`), la grandeur qui s'affiche et
 *    qui DÉPARTAGE à DR égal (`LDB 12 l.160`) — SAUF côté MONDE (aucun acteur : la base EST le seuil
 *    posé par l'appelant), SAUF canal `combat` (base = valeur de combat NUE, `combatBaseValue`) et
 *    SAUF `valeurEtrangere` (formule hors `testValue`, assumée au call-site) ;
 *  - `base + Σ mods + Difficulté + écrêtage === target` : tout l'écart est NOMMÉ (Soutien, États,
 *    Encombrement, séquelles, passifs, outil manquant — `testValueSplit`/`combatValueSplit`), aucune
 *    chip « autres » ;
 *  - la CIBLE dérive de la valeur FONDUE, écrêtée par la MÊME primitive que `rollTest` (`clampTarget`).
 *
 * GARDE D'EXACTITUDE : l'invariant arithmétique seul est TAUTOLOGIQUE (la base est une soustraction,
 * elle absorbe l'erreur). Une reconstruction ratée non déclarée — modificateur annoncé mais jamais
 * fondu, ou fondu ET redéclaré en double — THROW en DEV et se journalise en PROD (patron
 * `rollSansPilote`) : le mensonge se voit au premier passage au lieu de se lire comme une base juste.
 * Une Difficulté inconnue est refusée de même : sans elle la cible serait `NaN`, en silence.
 */
export function rollLine(spec: RollLineSpec): RollLineParts {
  const t = spec.test ?? {};
  const dansLaValeur = spec.dansLaValeur ?? [];
  const fusedSum = dansLaValeur.reduce((s, m) => s + m.value, 0);
  const dv = DIFFICULTY_MODIFIERS[spec.difficulty];
  if (typeof dv !== 'number') throw new Error(`rollLine : Difficulté inconnue « ${String(spec.difficulty)} » — la cible serait NaN.`);
  const value = spec.valeur ?? (spec.combat
    ? combatChannelValue(spec.actor, spec.combat, t)
    : (spec.actor ? testValue(spec.actor, t.skill, t.char, t.spec, t.sense) : 0));
  const split = spec.combat
    ? combatValueSplit(spec.actor, spec.combat, t, value, spec.soutien, fusedSum)
    : testValueSplit(spec.actor, value, {
      support: spec.soutien, skill: t.skill, characteristic: t.char, spec: t.spec, sense: t.sense, fused: fusedSum,
    });
  if (!split.exact && !spec.valeurEtrangere) {
    const formule = spec.combat ? (spec.combat.kind === 'test' ? 'la valeur de Test de combat brute' : 'la valeur de combat NUE') : 'le Niveau de Compétence';
    const msg = `[seam] rollLine : la valeur (${value}) ne se reconstruit pas depuis ${formule} `
      + `(${t.skill ?? t.char ?? spec.combat?.kind ?? '?'} de « ${spec.actor?.label ?? '?'} ») + ses composantes + ${fusedSum} déclaré(s) `
      + '— une poche est mal remplie (modificateur non fondu, ou fondu ET redéclaré). La base affichée serait FAUSSE.';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  const surLaCible = spec.surLaCible ?? [];
  const brut = surLaCible.reduce((s, m) => s + m.value, 0);
  // Mode plafonné (`LDB 14 l.91-96`) : la combinaison est celle du moteur, et son écart à la somme
  // brute devient une LIGNE. Sans elle, l'amputation ne serait imputable à personne.
  const combine = spec.plafond === 'difficultes' ? combineMods(surLaCible) : brut;
  const ecretage: ModLine[] = combine === brut
    ? []
    : [{ label: 'plafond Difficultés', value: combine - brut, famille: 'circonstance', ref: RULE_REF['combiner-les-difficultes'] }];
  const { target, clamped } = clampTarget(value + dv + combine);
  // PALIER DÉRIVÉ (`LDB 14 l.91-96` : « le brouillard ajouté au fait de vouloir toucher une
  // Localisation précise […] le Test devient simplement Très Difficile (-30) ») : en mode plafonné,
  // les circonstances quittent les chips et COMPOSENT la Difficulté de la ligne. Le palier se dérive
  // des CIRCONSTANCES SEULES (`combineCirc`) — trois conditions, toutes nécessaires :
  //  (a) au moins une circonstance — sinon le palier nommerait un pur artefact de plafond ;
  //  (b) une composition qui SOMME au palier. Comme elle vaut `combineCirc` par construction, cette
  //      égalité est VRAIE si et seulement si la Difficulté déclarée est Intermédiaire (dv = 0) :
  //      c'est le gate voulu — un site qui DÉCLARE sa Difficulté (Test de combat authoré Difficile)
  //      la garde, le palier ne peut pas l'avaler ; en combat d'attaque elle est Intermédiaire
  //      d'office (`LDB 13 l.118`), donc la dérivation opère ;
  //  (c) un palier EXACT de l'échelle — un −15 (bande Extrême halvée) n'en compose aucun.
  // La séparabilité des familles n'est plus une condition : `combineMods` ne plafonne QUE les
  // circonstances (`LDB 14 l.48/95`), donc `combine === combineCirc + Σ chips` par construction et
  // l'écrêtage nommé ne peut plus rembourser aux circonstances ce qu'il coupait aux mods au jet.
  const circonstances = spec.plafond === 'difficultes' ? surLaCible.filter((m) => m.famille === 'circonstance') : [];
  const composition = [...circonstances, ...ecretage];
  const enChips = surLaCible.filter((m) => !circonstances.includes(m));
  const combineCirc = combineMods(circonstances);
  const palierMod = dv + combineCirc;
  const palier = circonstances.length && composition.reduce((s, m) => s + m.value, 0) === palierMod
    ? exactDifficultyFromModifier(palierMod)
    : undefined;
  return {
    base: split.base - fusedSum,
    mods: palier
      ? [...split.mods, ...dansLaValeur, ...enChips]
      : [...split.mods, ...dansLaValeur, ...surLaCible, ...ecretage],
    target,
    ...(clamped ? { clamped } : {}),
    difficulty: palier ?? spec.difficulty,
    ...(palier ? { difficultyParts: composition } : {}),
  };
}

/** Étale une ligne montée en CHAMPS d'étape (`CascadeStep`/`BatchParticipant`) : `mods` et `clamped`
 *  ne sont posés que s'ils existent — un monteur local ne réécrit jamais cet étalement à la main.
 *
 *  N'étale NI `difficulty` NI `difficultyParts` : ses 42 appelants posent eux-mêmes la Difficulté
 *  après l'étalement, et AUCUN n'ouvre le mode plafonné (le seul régime qui DÉRIVE un palier). Le
 *  jour où l'un le fait, il lui faut relayer les deux champs ensemble — sans quoi les chips
 *  amputées de leurs circonstances laisseraient un écart « autres ». Verrouillé par la garde
 *  « `rollStep` + `plafond` » (`src/state/roll-line-combat.test.ts`). */
export function rollStep(spec: RollLineSpec): { base: number; mods?: ModLine[]; target: number; clamped?: number } {
  const line = rollLine(spec);
  return {
    base: line.base,
    ...(line.mods.length ? { mods: line.mods } : {}),
    target: line.target,
    ...(line.clamped ? { clamped: line.clamped } : {}),
  };
}

/** Résout un test skill/char SIMPLE (mono, `hero-test`/`enemy`/`subi` à `actorId`) en `CascadeStep`
 *  prêt pour `startCascade`/`runCascadeImmediate` — calque `openSkillTest` (`combatEffects.ts:313-397`)
 *  réduit au cas générique (pas de candidats/mod social : hors périmètre du seam Ronde 0). */
function buildMonoStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const { actorId, actor, baseValue, support } = resolveMonoSide(get, req, meta);
  // Ligne montée par le MONTEUR CANONIQUE : la cible reste dérivée de la valeur FONDUE (`testValue`
  // pour un acteur désigné, la valeur SOUTENUE de `partyAssisted`/le seuil `meta.baseValue` sinon).
  const line = rollLine(baseValue != null
    ? { actor, test: req.test, difficulty: req.difficulty, valeur: baseValue, soutien: support }
    : { actor, test: req.test, difficulty: req.difficulty });
  return {
    id: kind,
    kind,
    actorId,
    // Côté `worldSide` sans acteur (désertion, Moral, périls…) : marque l'étape MONDE — l'arbitre
    // (`modalArbiter.ts`) route son owner au siège MJ via le sentinel `WORLD_STEP_OWNER`
    // (`netOwnership.seatOwns`), à l'hôte sinon (écart 1 documenté en tête de fichier, fermé Ronde 1).
    ...(!actorId && 'worldSide' in req.side ? { worldOwner: true } : {}),
    label: composeRollLabel(actor, req.actionLabel, req.test),
    // Difficulté en donnée de LIGNE (#1072) : la modale la rend en texte + valeur sur la rangée ; sa
    // valeur est déjà comprise dans `target` (`rollLine`).
    difficulty: req.difficulty,
    // Compétence DÉRIVÉE du catalogue (`testSkillLabel`) — jamais `req.actionLabel` sauf repli (Test
    // SANS compétence/carac déclarée, ex. Désertion : rien à nommer en position de compétence).
    rollLabel: testSkillLabel(req.test) ?? req.actionLabel,
    base: line.base,
    ...(line.mods.length ? { mods: line.mods } : {}),
    target: line.target,
    ...(line.clamped ? { clamped: line.clamped } : {}),
    result: null,
    interactive: true,
    menace: req.test.menace,
    ...(req.stake ? { stake: req.stake } : {}),
    meta,
  };
}

/** Résout le côté `batch` en étape À PARTICIPANTS (seam de jet #275 Décision 4 cran 1/2, FERME l'écart
 *  2 de la Ronde 0) : UNE rangée par contributeur (`CascadeStep.participants`), non résolue — le jet de
 *  chaque contributeur vit dans la modale (flux `cascadeBatch`) ou, en surface I, dans
 *  `cascade.rollBatchParticipants` (`runCascadeImmediate`). L'AGRÉGAT (`step.aggregate` + `step.meta`
 *  NEUTRE : `aggregateFlatDR`/`aggregateCapTo`/`aggregateOpposeSl`) est calculé GÉNÉRIQUEMENT par
 *  `cascade.aggregateBatchStep` à la VALIDATION — ce constructeur ne lance AUCUN dé lui-même : chaque
 *  contributeur reste influençable individuellement avant l'agrégat (écart 2 de la Ronde 0). */
function buildBatchStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const participants = 'participants' in req.side ? req.side.participants : [];
  void get;
  return {
    id: kind,
    kind,
    label: req.actionLabel,
    participants,
    aggregate: req.aggregate ?? 'summed-dr',
    interactive: true,
    ...(req.stake ? { stake: req.stake } : {}),
    meta,
  };
}

/**
 * LA PORTE UNIQUE (Décision 1). Résout policy(klass × contrôleur × cadence) → surface, construit
 * l'étape puis :
 *  - M/V (surfacé) : `startCascade` — la CONTINUATION est l'applier `kind` (lu à l'« Appliquer »,
 *    déjà câblé par `commitStep`/`cascadeAppliers`, `cascade.ts:107-110`) ;
 *  - I (inline) : `runCascadeImmediate` — MÊME registre, appelé d'office (mirror `runSkillTest`).
 * `meta` = paramètres SÉRIALISABLES de la conséquence (jamais de closure — coop, `CascadeStepMeta`).
 * Ne renvoie rien : le call-site est un one-liner déclaratif + son applier enregistré au préalable
 * (`registerCascadeApplier(kind, applier)`, `cascade.ts:57`).
 */
export function openRoll(get: Get, set: Set, req: RollRequest, kind: string, meta?: CascadeStepMeta): void {
  // Côté `partyBest` sans candidat (aucun PJ éligible à la compétence/carac visée) : rien à ouvrir —
  // même garde que l'ancien `if (best)` des call-sites (mandat coordinateur : la porte résout, donc
  // c'est ICI que le silence se décide, plus au call-site).
  if ('partyBest' in req.side && !resolveMonoSide(get, req).actor) return;
  const surface = resolveSurface(get, req, kind);
  const step = req.klass === 'batch' ? buildBatchStep(get, req, kind, meta) : buildMonoStep(get, req, kind, meta);
  if (surface === 'I') {
    runCascadeImmediate(get, set, [step]);
    return;
  }
  startCascade(get, set, { title: rollTitle(get, req), purpose: 'test', steps: [step] });
}

/**
 * FORME STÉRÉOTYPÉE 1/2 (#352 extension) : le meilleur PJ du groupe teste UNE compétence/carac
 * (`klass:'hero-test'`, side `partyBest`) — 8 call-sites identiques avaient la compétence RÉPÉTÉE
 * (`side.partyBest.skill` ET `req.test.skill`, divergence exprimable = bug possible). SOURCE UNIQUE :
 * la compétence se déclare UNE FOIS ; `side`/`test` la reprennent ICI, jamais recopiée au call-site.
 * Réserve `openRoll` (exporté) aux formes hors ce patron (`enemy`/`batch`/`actorId` — cf. `rollSeam.test.ts`).
 */
export function openPartyTest(
  get: Get, set: Set,
  spec: { skill: string; char?: CharKey; assisted?: boolean; spec?: string; sense?: PairedSense; menace?: string; noSupport?: boolean; actionLabel: string; difficulty: Difficulty; stake?: StakeRef },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  const { skill, char, assisted, spec: specName, sense, menace, noSupport, actionLabel, difficulty, stake } = spec;
  openRoll(get, set, {
    side: { partyBest: { skill, char, assisted } },
    actionLabel,
    test: { skill, char, spec: specName, sense, menace, noSupport },
    difficulty,
    klass: 'hero-test',
    ...(stake ? { stake } : {}),
  }, kind, meta);
}

/**
 * FORME STÉRÉOTYPÉE 2/2 (#352 extension) : Test SUBI par le siège MONDE (`klass:'subi'`, side
 * `worldSide`) — désertion/recherche d'acheteur : aucune compétence (la cible est posée par
 * l'appelant via `meta.baseValue`), seul `ownerId` varie. SOURCE UNIQUE, cf. `openPartyTest`.
 */
export function openWorldTest(
  get: Get, set: Set,
  spec: { ownerId: string; actionLabel: string; difficulty: Difficulty; stake?: StakeRef },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  openRoll(get, set, {
    side: { worldSide: 'world', ownerId: spec.ownerId },
    actionLabel: spec.actionLabel,
    test: {},
    difficulty: spec.difficulty,
    klass: 'subi',
    ...(spec.stake ? { stake: spec.stake } : {}),
  }, kind, meta);
}

/** Reconstruit l'issue SCELLÉE (`TestOutcome`) d'une étape déjà résolue — lecture PARTAGÉE pour les
 *  appliers/continuations qui veulent le même vocabulaire `won`/`sl` que la fabrique de jet (au lieu
 *  de relire `step.result` à la main). `null` si l'étape n'a pas encore de résultat. */
export function outcomeOfStep(step: CascadeStep): TestOutcome | null {
  if (!step.result) return null;
  const { roll, target, sl, success } = step.result;
  return TestOutcome.seal({ roll, target, success, sl, isDouble: false });
}

/**
 * PORTE DE REPLI SANS-PILOTE (#918 phase 2a) — l'autre sortie du seam, jumelle d'`openRoll` : quand
 * AUCUN humain ne pilote l'acteur, il n'y a rien à surfacer, le Test se roule et se rend BRUT. Les
 * flux bricolaient chacun le même invariant (`if (!humanControlled(get(), c)) rollTest(…)`) : la
 * garde tenait dans le call-site, donc rien n'empêchait qu'un chemin voisin y amène un acteur piloté.
 * L'invariant vit désormais ICI, une fois.
 *
 * Prédicat : `humanControlled` — le MÊME que `resolveSurface` (surface M) et que la garde de surfaçage
 * (`maneuver-defense-cascade.test.ts`), donc CADENCE-AWARE : en Rapide/Auto les jets se lancent seuls
 * sans influence (`netOwnership.humanControlled`), ce repli est alors la voie normale d'un héros.
 * `actor` absent (côté monde, conducteur sans acteur joueur) : aucun pilote possible, invariant vide.
 *
 * DEV : la violation THROW (le jet silencieux se voit au premier passage) ; en PROD elle se journalise
 * en `console.error` et le jet est rendu quand même — jamais casser une partie en cours.
 *
 * `value`/`difficulty`/`rng`/`modifier` : la forme de `rollTest` (`engine/tests.ts`), passés tels quels.
 */
export function rollSansPilote(
  get: Get,
  actor: Combatant | undefined,
  value: number,
  difficulty: Difficulty = 'intermediaire',
  rng: RNG = defaultRNG,
  modifier = 0,
): TestResult {
  if (actor && humanControlled(get(), actor)) {
    const msg = `[seam] jet silencieux d'un acteur piloté (« ${actor.label} ») — router par openRoll/flow.`;
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  return rollTest(value, difficulty, rng, modifier);
}
