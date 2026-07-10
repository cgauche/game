/**
 * SEAM DE JET UNIQUE (#275, Ronde 0 — substrat) — `docs/plans/2026-07-10-conception-seam-de-jet.md`,
 * Décision 1 (API) + Décision 3 (table de policy). Extension de la fabrique existante
 * (`makeRollFlow`/`FLOWS`, `rollFlowFactory.ts`) + `cascade.ts` (séquenceur) — RIEN de parallèle.
 *
 * `openRoll` DÉCRIT un jet (`RollRequest`) et une CONTINUATION enregistrée par `kind`
 * (`registerCascadeApplier`, `cascade.ts:57`) ; la porte RÉSOUT la policy `klass × contrôleur ×
 * cadence` (Décision 3) via les prédicats EXISTANTS (`humanControlled`/`pilotedByHuman`/`cadenceAuto`/
 * `seaAutoResolves`) et choisit la surface :
 *   M = modale influençable (`startCascade`, propriétaire = l'acteur humain) ;
 *   V = étape visible-lançable MJ (`startCascade`, propriétaire = le siège `gmSeat` via `actorId` —
 *       cf. écart documenté ci-dessous pour `worldSide`) ;
 *   I = inline-PV (`runCascadeImmediate`, aucune influence, conséquence appliquée d'office).
 * AUCUN call-site n'est migré en Ronde 0 (substrat seul, DoD #275 Ronde 0) : ce module n'est câblé nulle
 * part hors de ses propres tests et de `testOutcome.ts`.
 *
 * ÉCARTS documentés vs le doc de conception (justifiés, à réconcilier aux rondes suivantes) :
 *  1. **`worldSide` → propriétaire MJ non routé.** Le doc (Décision 3) veut `worldSide → gmSeat`
 *     directement. La résolution RÉELLE de l'owner d'une étape de cascade vit dans `modalArbiter.ts`
 *     (`owner(s) = cur?.groupOwner ? '*' : cur?.actorId`) et `netOwnership.seatOwns` (routage gmSeat
 *     UNIQUEMENT si `actorId` référence un combattant `kind:'enemy'` EN BATAILLE) — ni l'un ni l'autre
 *     n'est dans le périmètre de fichiers de cette Ronde. Une étape `worldSide` sans `actorId` retombe
 *     donc sur le routage EXISTANT (propriétaire par défaut = siège hôte), pas sur `gmSeat`. Sans
 *     conséquence en Ronde 0 (0 call-site) ; à fermer quand un site `worldSide` migre réellement
 *     (Ronde 1+, en étendant `modalArbiter`/`netOwnership` — hors périmètre ici).
 *  2. **`batch` n'utilise PAS `CascadeStep.participants`.** Cette extension est EXPLICITEMENT Ronde 2
 *     (brief : « pas l'extension participants, c'est ronde 2 »). En Ronde 0, `openRoll('batch', …)`
 *     résout l'AGRÉGAT des contributeurs immédiatement (rôle par rôle, `rollCrewRole`/`forceCrewRole`,
 *     MDG ch.14) et pose une étape UNIQUE dont le `result` porte l'agrégat — la modale montre le
 *     TOTAL ; « une rangée par PJ » exige `CascadeStep.participants` (Décision 4), scope Ronde 2.
 *     Les paramètres de formule que `RollRequest` ne porte pas (Moral du navire, Manque de bras,
 *     sabotage — `maneuverCrewTotal`, `shipManeuver.ts:67`) transitent par `meta` (seule voie
 *     SÉRIALISABLE existante, `CascadeStepMeta`) quand le call-site les fournit ; par défaut 0/absent.
 */
import type { Get, Set } from './flowTypes';
import type { GameState } from './store';
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import type { PairedSense } from '../engine/ops';
import type { CascadeStep, CascadeStepMeta, ShipManeuverParticipant } from './pendings';
import { TestOutcome } from '../engine/testOutcome';
import { actorIn } from './combatOrParty';
import { startCascade, runCascadeImmediate } from './cascade';
import { testValue } from '../engine/skills';
import { getTestPolicy } from '../engine/testPolicy';
import { battleRng } from './battleRng';
import { humanControlled, pilotedByHuman } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { seaAutoResolves } from './voyageCadence';
import { rollCrewRole, forceCrewRole, maneuverCrewTotal, type CrewRoleRoll } from './shipManeuver';

/** Les 4 classes déclaratives (mandat #275). Pilotent la POLICY, jamais le call-site. */
export type RollClass = 'hero-test' | 'enemy' | 'subi' | 'batch';

/** Agrégation d'un jet multi (porte/contresort/équipage) — SEULE variation de la famille multi. */
export type RollAggregate = 'best' | 'opposed' | 'summed-dr';

/** DESCRIPTION déclarative d'un jet. Le call-site remplit ceci et RIEN d'autre. */
export interface RollRequest {
  /** Le côté qui teste : un acteur (héros/PNJ), le siège MONDE (ennemi/subi), ou des participants (batch). */
  side:
    | { actorId: string }
    | { worldSide: 'enemy' | 'ship'; shipId?: string }
    | { participants: ShipManeuverParticipant[]; shipId: string };
  /** Le TEST déclaré (réf structurée — passe telle quelle à `testValue`). */
  test: { skill?: string; char?: CharKey; spec?: string; sense?: PairedSense; menace?: string; label: string };
  difficulty: Difficulty;
  klass: RollClass;
  /** Requis pour un `batch`/multi ; défaut `summed-dr` (Test d'équipage, MDG ch.14). */
  aggregate?: RollAggregate;
}

/** Trois surfaces (Décision 3) : Modale influençable / Visible-lançable MJ / Inline-PV. */
type Surface = 'M' | 'V' | 'I';

/** Cible EFFECTIVE (difficulté déjà appliquée) d'un Test skill/char — même arithmétique que
 *  `rollTest` (`clamp(value+DIFFICULTY_MODIFIERS[difficulty], policy)`, `engine/tests.ts:59`), sans
 *  dupliquer `clamp` (privée à `tests.ts`, hors périmètre de cette Ronde). `baseOverride` (via `meta`)
 *  couvre les côtés `worldSide` sans acteur (aucune `testValue` à calculer) — cf. écart documenté 1. */
function effectiveTarget(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): number {
  const value = baseOverride ?? (actor ? testValue(actor, test.skill, test.char, test.spec, test.sense) : 0);
  const policy = getTestPolicy();
  return Math.max(policy.targetMin, Math.min(policy.targetMax, value + DIFFICULTY_MODIFIERS[difficulty]));
}

/** Policy `klass × contrôleur × cadence` (Décision 3, table COMPLÈTE) — adossée aux prédicats
 *  EXISTANTS, jamais au `kind`. `autoC` (Rapide/Auto global) domine partout ; `autoV` (voyage COMMANDÉE
 *  + `kind` de routine, `seaAutoResolves`) route ensuite ; le reste dépend de la classe + du contrôle. */
function resolveSurface(get: Get, req: RollRequest, kind: string): Surface {
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

  const actor = 'actorId' in req.side ? actorIn(s, req.side.actorId) : undefined;

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
  const actorId = 'actorId' in req.side ? req.side.actorId : undefined;
  const actor = actorId ? actorIn(get(), actorId) : undefined;
  const baseOverride = typeof meta?.baseValue === 'number' ? meta.baseValue : undefined;
  const target = effectiveTarget(actor, req.test, req.difficulty, baseOverride);
  return {
    id: kind,
    kind,
    actorId,
    label: req.test.label,
    rollLabel: req.test.label,
    base: baseOverride ?? (actor ? testValue(actor, req.test.skill, req.test.char, req.test.spec, req.test.sense) : 0),
    target,
    result: null,
    interactive: true,
    menace: req.test.menace,
    meta,
  };
}

/** Résout l'AGRÉGAT `batch` (Décision Ronde 0, écart 2 ci-dessus) : chaque contributeur lance SON rôle
 *  (`rollCrewRole`, MDG ch.14), sommé (`summed-dr`, essentiel ×2 via `maneuverCrewTotal`), ou réduit au
 *  meilleur (`best`)/à une marge d'opposition (`opposed`) — puis scellé en UNE étape `CascadeStep`. */
function buildBatchStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const participants = 'participants' in req.side ? req.side.participants : [];
  const s = get();
  const rolled = participants.map((p) => {
    const crew = actorIn(s, p.id);
    const roll: CrewRoleRoll | null = crew ? rollCrewRole(crew, p.roleId, battleRng(), p.cumul, p.sense) : null;
    return { ...p, result: roll };
  });
  const aggregate = req.aggregate ?? 'summed-dr';
  let sl: number;
  let success: boolean;
  if (aggregate === 'best') {
    const best = rolled.reduce<CrewRoleRoll | null>((m, p) => (p.result && (!m || p.result.sl > m.sl) ? p.result : m), null);
    sl = best?.sl ?? 0;
    success = sl > 0;
  } else {
    const essentialRoleId = typeof meta?.essentialRoleId === 'string' ? meta.essentialRoleId : undefined;
    const moraleScore = typeof meta?.moraleScore === 'number' ? meta.moraleScore : 0;
    const extraDR = typeof meta?.extraDR === 'number' ? meta.extraDR : 0;
    const undercrewDR = typeof meta?.undercrewDR === 'number' ? meta.undercrewDR : undefined;
    const undercrew = undercrewDR != null ? { dr: undercrewDR, capSuccesMinime: !!meta?.capSuccesMinime } : undefined;
    const total = maneuverCrewTotal(rolled, essentialRoleId, moraleScore, undercrew, extraDR);
    if (aggregate === 'opposed') {
      const opposeSl = typeof meta?.opposeSl === 'number' ? meta.opposeSl : 0;
      sl = total - opposeSl;
      success = sl > 0;
    } else {
      sl = total;
      success = total >= 1; // « si le total est de 1 DR ou plus, succès » (MDG ch.14 l.13, `shipManeuver.ts:85`)
    }
  }
  return {
    id: kind,
    kind,
    label: req.test.label,
    result: { roll: 0, target: 0, sl, success },
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
  const surface = resolveSurface(get, req, kind);
  const step = req.klass === 'batch' ? buildBatchStep(get, req, kind, meta) : buildMonoStep(get, req, kind, meta);
  if (surface === 'I') {
    runCascadeImmediate(get, set, [step]);
    return;
  }
  startCascade(get, set, { title: req.test.label, purpose: 'test', steps: [step] });
}

/** Reconstruit l'issue SCELLÉE (`TestOutcome`) d'une étape déjà résolue — lecture PARTAGÉE pour les
 *  appliers/continuations qui veulent le même vocabulaire `won`/`sl` que la fabrique de jet (au lieu
 *  de relire `step.result` à la main). `null` si l'étape n'a pas encore de résultat. */
export function outcomeOfStep(step: CascadeStep): TestOutcome | null {
  if (!step.result) return null;
  const { roll, target, sl, success } = step.result;
  return TestOutcome.seal({ roll, target, success, sl, isDouble: false });
}
