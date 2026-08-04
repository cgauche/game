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
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { DIFFICULTY_MODIFIERS, DIFFICULTY_LABELS, CHAR_LABELS } from '../engine/types';
import type { PairedSense, GameOp } from '../engine/ops';
import type { CascadeStep, CascadeStepMeta, BatchParticipant, CascadeAggregate } from './pendings';
import type { RecapLine, RecapTone } from './recapLine';
import { TestOutcome } from '../engine/testOutcome';
import { actorIn } from './combatants';
import { startCascade, runCascadeImmediate } from './cascade';
import { testValue, partyBest, partyAssisted } from '../engine/skills';
import { getTestPolicy } from '../engine/testPolicy';
import { humanControlled, pilotedByHuman } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { seaAutoResolves } from './voyageCadence';
import { findSkillById, conditionLabel } from '../data';
import { t, type OutKey, type OutVars } from '../i18n';
import { rollTest } from '../engine/tests';
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
}

/** Trois surfaces (Décision 3) : Modale influençable / Visible-lançable MJ / Inline-PV. */
type Surface = 'M' | 'V' | 'I';

/** Cible EFFECTIVE (difficulté déjà appliquée) d'un Test skill/char — même arithmétique que
 *  `rollTest` (`clamp(value+DIFFICULTY_MODIFIERS[difficulty], policy)`, `engine/tests.ts:59`), sans
 *  dupliquer `clamp` (privée à `tests.ts`, hors périmètre de cette Ronde). `baseOverride` couvre les
 *  côtés SANS acteur (`worldSide` — via `meta.baseValue`) ou dont la valeur EST l'acteur+valeur choisis
 *  par la porte (`partyBest`) — RÉSERVÉ à ces deux cas (extension mandat coordinateur) : un côté
 *  `actorId` calcule TOUJOURS `testValue` ICI, jamais un `meta.baseValue` du call-site. */
export function effectiveTarget(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): number {
  const value = baseOverride ?? (actor ? testValue(actor, test.skill, test.char, test.spec, test.sense) : 0);
  const policy = getTestPolicy();
  return Math.max(policy.targetMin, Math.min(policy.targetMax, value + DIFFICULTY_MODIFIERS[difficulty]));
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
 *  coordinateur) : plus un call-site n'assemble `${actor.name} — ${action} (${skill} ${difficulté})` à
 *  la main. `action` = `req.actionLabel` (nom seul) ; le détail (compétence/carac + difficulté) est
 *  omis si le Test ne porte ni compétence ni caractéristique. Position : `step.label` (sous-titre
 *  d'étape) — JAMAIS le titre de cascade (`rollTitle`, plus court, pas de duplication). */
export function composeRollLabel(actor: Combatant | undefined, action: string, test: RollRequest['test'], difficulty: Difficulty): string {
  const skillLabel = testSkillLabel(test);
  const detail = skillLabel ? `${skillLabel} ${DIFFICULTY_LABELS[difficulty]}` : undefined;
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
 */
export function resultLines(cons: Consequence[]): RecapLine[] {
  return cons
    .map((c): RecapLine => ('say' in c
      ? { text: t(c.say, c.vars), tone: c.tone ?? 'info', ...(c.icon ? { icon: c.icon } : {}) }
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
function resolveMonoSide(get: Get, req: RollRequest, meta?: CascadeStepMeta): { actorId?: string; actor?: Combatant; baseValue?: number } {
  if ('actorId' in req.side) {
    return { actorId: req.side.actorId, actor: actorIn(get(), req.side.actorId) };
  }
  if ('partyBest' in req.side) {
    const { skill, char, assisted } = req.side.partyBest;
    // `noSupport` (LDB 12 l.197) : Test de résistance déclaré sur le spec → jamais de Soutien, même si
    // `assisted` n'a pas été mis à `false` au call-site.
    const picked = assisted === false || req.test.noSupport
      ? partyBest(get().party, skill, char)
      : partyAssisted(get().party, skill, char);
    if (!picked) return {};
    return { actorId: picked.actor.id, actor: picked.actor, baseValue: picked.value };
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

/** Résout un test skill/char SIMPLE (mono, `hero-test`/`enemy`/`subi` à `actorId`) en `CascadeStep`
 *  prêt pour `startCascade`/`runCascadeImmediate` — calque `openSkillTest` (`combatEffects.ts:313-397`)
 *  réduit au cas générique (pas de candidats/Soutien/mod social : hors périmètre du seam Ronde 0). */
function buildMonoStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const { actorId, actor, baseValue } = resolveMonoSide(get, req, meta);
  const target = effectiveTarget(actor, req.test, req.difficulty, baseValue);
  return {
    id: kind,
    kind,
    actorId,
    // Côté `worldSide` sans acteur (désertion, Moral, périls…) : marque l'étape MONDE — l'arbitre
    // (`modalArbiter.ts`) route son owner au siège MJ via le sentinel `WORLD_STEP_OWNER`
    // (`netOwnership.seatOwns`), à l'hôte sinon (écart 1 documenté en tête de fichier, fermé Ronde 1).
    ...(!actorId && 'worldSide' in req.side ? { worldOwner: true } : {}),
    label: composeRollLabel(actor, req.actionLabel, req.test, req.difficulty),
    // Compétence DÉRIVÉE du catalogue (`testSkillLabel`) — jamais `req.actionLabel` sauf repli (Test
    // SANS compétence/carac déclarée, ex. Désertion : rien à nommer en position de compétence).
    rollLabel: testSkillLabel(req.test) ?? req.actionLabel,
    base: baseValue ?? (actor ? testValue(actor, req.test.skill, req.test.char, req.test.spec, req.test.sense) : 0),
    target,
    result: null,
    interactive: true,
    menace: req.test.menace,
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
  spec: { skill: string; char?: CharKey; assisted?: boolean; spec?: string; sense?: PairedSense; menace?: string; noSupport?: boolean; actionLabel: string; difficulty: Difficulty },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  const { skill, char, assisted, spec: specName, sense, menace, noSupport, actionLabel, difficulty } = spec;
  openRoll(get, set, {
    side: { partyBest: { skill, char, assisted } },
    actionLabel,
    test: { skill, char, spec: specName, sense, menace, noSupport },
    difficulty,
    klass: 'hero-test',
  }, kind, meta);
}

/**
 * FORME STÉRÉOTYPÉE 2/2 (#352 extension) : Test SUBI par le siège MONDE (`klass:'subi'`, side
 * `worldSide`) — désertion/recherche d'acheteur : aucune compétence (la cible est posée par
 * l'appelant via `meta.baseValue`), seul `ownerId` varie. SOURCE UNIQUE, cf. `openPartyTest`.
 */
export function openWorldTest(
  get: Get, set: Set,
  spec: { ownerId: string; actionLabel: string; difficulty: Difficulty },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  openRoll(get, set, {
    side: { worldSide: 'world', ownerId: spec.ownerId },
    actionLabel: spec.actionLabel,
    test: {},
    difficulty: spec.difficulty,
    klass: 'subi',
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
