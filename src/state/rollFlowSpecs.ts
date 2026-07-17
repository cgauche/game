/**
 * Specs des flux de jet différé (cf. `rollFlow.ts` pour le cycle de vie générique).
 *
 * Chaque entrée de `FLOWS` déclare la partie MÉTIER d'un flux (comment résoudre le jet, quand il
 * est relançable, comment la Chance « +1 DR » et la Résilience re-dérivent le résultat) ; le store
 * câble les handlers générés sous les noms canoniques (`trampleRoll`, `trampleReroll`…) et garde
 * la main sur « Appliquer » (`xConfirm`) et « Annuler ».
 *
 * Fidélité : chaque `resolve`/`derive` reprend À L'IDENTIQUE le code historique du store
 * (références RAW en place). Ne rien y « simplifier » sans citer la source.
 */
import type {
  GameState,
  PendingTrample, PendingBattement, PendingDistraire, PendingManeuver, PendingRun, PendingShipManeuver, ShipManeuverParticipant, PendingShipBattery, ShipBatteryParticipant, PendingCrewTest, PendingShanty, PendingFocus, PendingDispel, PendingFrenzy, PendingApproach, PendingWard,
  PendingReload, PendingStateRecovery, PendingTest, PendingSteamSave, PendingAppraise, PendingBargain, PendingHeal, PendingSurgery,
  PendingCorruption, PendingAttack, PendingHandGate, PendingDefense, PendingCast, PendingDisengage, PendingAuContact, PendingGrapple,
  PendingCounterspell, CounterParticipant, PendingExtendedTest, ExtendedTestRound,
  PendingForceDoor, ForceDoorParticipant,
  PendingCastOpposition, OppositionParticipant,
  PendingCascade, CascadeStep, BatchParticipant,
} from './store';
import type { PendingActivity } from './interludeFlow';
import type { Combatant, Weapon } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { makeRollFlow, type RollFlowHandlers, type RollFlowLens, type PendingBase } from './rollFlowFactory';
import { TestOutcome } from '../engine/testOutcome';
import type { RollBreakdown } from '../engine/combat';
import { battleRng } from './battleRng';
import { actorIn, inBattleId, touchActors, seaMagicContext } from './combatOrParty';
import {
  TRAMPLE_WEAPON, resolveAttack, firedWeapon, bestDefenseMode, effectiveSpellOf,
  castInfoIsPrayer, disengageOutcome, castWardPenalty, domainCastBonus,
  rollManeuverAttacker, maneuverAttackerDifficulty, distraireAttackValue,
} from './combatFlow';
import { bus, EVT } from './bus';
import { campSpend } from './combat/advantagePool';
import { domainEnvironmentBonus } from '../engine/domainAttributes';
import { creatureAttacks } from '../engine/creatureAttacks';
import { mountMovement, mountedDodgePenalty } from './mount';
import { sceneCombatModifiers } from './sceneRules';
import { sceneMetresPerTile } from './scene';
import { resolveTrample, rederivePassiveAttack, finishMelee, finishRanged, rollMeleeDefender, rollDisengageAttack, rollGrappleForce, combatValue, type AttackResult, type DefenseSub } from '../engine/combat';
import { reverseRoll } from '../engine/combat';
import { talentReverseFailed, runMovementBonus } from '../engine/combatFeatures/dispatch';
import { consumeReverseToken } from '../engine/reverseToken';
import { rollTest, resolveOpposed, bumpSL, type TestResult, evaluateTest, evaluateCombinedTest, maxForcedRoll, bestForcedRoll, forcedTR, hydrateTR } from '../engine/tests';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import { d100, defaultRNG, type RNG } from '../engine/dice';
import { resolveRun } from '../engine/movement';
import { rollCrewRole, forceCrewRole } from './shipManeuver';
import { rollBatchParticipant, forceBatchParticipant } from './cascade';
import { testValue, effectiveSkillCharKey, skillBaseValue } from '../engine/skills';
import { skillDRBonus, charDRBonusOf, offTerrainTestDR } from '../engine/ops';
import { resolveFocus, resolveMagicMissile, resolveCasting, rederiveCastSL, castTestTalentDR, talentTestSLBonus, resolveCounterspell, counterspellOutcomeFrom, castTestOf, castingValue } from '../engine/magic';
import { discreetPrayerDifficulty } from '../engine/prayer';
import { rule } from '../engine/policy';
import { effectiveChar, bonus } from '../engine/characteristics';
import { resolveFrenzyEntry, calmeValue, psychResolution, spendResolveForPsychImmunity } from '../engine/psychology';
import { findSpellById, findSkillById } from '../data/index';

/** Re-dérive une attaque FIGÉE avec un jet d'attaquant modifié (Chance +1 DR / Résilience / dé
 *  choisi) : Test opposé si un défenseur a joué, attaque passive sinon — partagé attaque/force. */
function rederiveAttack(attacker: Combatant, target: Combatant, p: PendingAttack, atk2: TestResult, combatants?: Combatant[]): AttackResult {
  const weapon = firedWeapon(attacker, target, p.weaponUid, combatants, p.harpoonRopeCut); // arme + munition + sous-effectif du poste (le re-jet voit la MÊME arme que la résolution)
  const r = p.result!;
  if (r.defenderDetail) {
    const dd = r.defenderDetail;
    const def: TestResult = hydrateTR(dd);
    // p.withhold (Retenir ses coups, AA) propagé : la re-dérivation Chance/Résilience garde le coup non létal.
    return finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), p.location ?? undefined, [], 0, undefined, undefined, p.withhold);
  }
  return rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', p.location ?? undefined, p.withhold);
}

/** Résout le résultat d'une défense réactive : TIR DÉFENDU (`finishRanged`, opposition RAW à distance —
 *  Protectrice 2+/Bout Portant/tireur Engagé) OU mêlée (`finishMelee`), selon le type d'arme FIGÉE de
 *  l'attaquant. `p.distanceTiles` sert au breakdown Projectiles ; `parry` = arme de parade choisie. */
function finishDefenseResult(attacker: Combatant, defender: Combatant, p: PendingDefense, def: TestResult, dodgeMod = 0, parry?: Weapon, metresPerTile = 2): AttackResult {
  const sub = defenseSubOf(defender, p);
  return p.weapon.type === 'ranged'
    ? finishRanged(attacker, defender, p.weapon, p.atk, def, p.mode, p.distanceTiles, p.location ?? undefined, [], parry, dodgeMod, metresPerTile)
    : finishMelee(attacker, defender, p.weapon, p.atk, def, p.mode, p.location ?? undefined, [], dodgeMod, undefined, parry, false, sub);
}

/** Descripteur de la défense par SUBSTITUTION sociale (Intimidation/Dressage, LDB 09 l.207/287), ou
 *  `undefined` hors mode 'social'. Base = valeur de Test de la Compétence figée au choix
 *  (`substituteSkillId`, `skillBaseValue`) ; libellé = son nom d'affichage. */
function defenseSubOf(defender: Combatant, p: PendingDefense): DefenseSub | undefined {
  if (p.mode !== 'social' || !p.substituteSkillId) return undefined;
  return { base: skillBaseValue(defender, p.substituteSkillId), label: findSkillById(p.substituteSkillId)?.label ?? DEFENSE_LABEL_FALLBACK };
}
const DEFENSE_LABEL_FALLBACK = 'Intimidation';

/** Issue d'une étape de cascade `triggeredTest` OPPOSÉE : le DÉFENSEUR (victime) vient de jeter `def` ;
 *  l'ATTAQUANT (porteur) garde son jet FIGÉ `aT`. `resolveOpposed(aT, def)` met l'ATTAQUANT en 1ʳᵉ
 *  position (la victoire RAW « Si vous [attaquant] remportez le Test » et le départage par valeur la
 *  plus haute sont du côté attaquant). Le défenseur RÉSISTE (`success`) si l'attaquant ne l'emporte PAS
 *  — c'est-à-dire défenseur vainqueur OU ÉGALITÉ (LDB 62 l.268 : l'attaquant doit REMPORTER, pas faire
 *  nul). Le `sl` reporté est le DR PROPRE du défenseur (échelle des branches). `bonusSL` (Piège-lame, LDB 62
 *  l.295) s'AJOUTE au DR du défenseur AVANT l'opposition — modifie le vainqueur ET la marge nette, mais PAS
 *  le `sl` reporté (= DR propre, la conséquence recompose la marge via le contexte figé). Calque `disengageOutcome`. */
function opposedCascadeRoll(def: TestResult, aT: TestResult, target: number, bonusSL = 0): { roll: number; target: number; sl: number; success: boolean } {
  const o = resolveOpposed(aT, { ...def, sl: def.sl + bonusSL });
  return { roll: def.roll, target, sl: def.sl, success: o.winner !== 'attacker' };
}

// ── Délégués de jet du store : générateur + types (fin de la duplication ~113 lignes) ──
//
// Chaque flux de `FLOWS` est câblé dans le store sous des noms canoniques `<prefix><Verbe>`
// (`trampleRoll`, `trampleReroll`…). Ces délégués étaient écrits À LA MAIN, un par ligne — un
// SOUS-ENSEMBLE hétérogène des 6 verbes par flux (un flux sans `caps.forced` n'expose pas
// `…ForceSuccess`/`…SetForcedRoll`, etc.). `rollFlowActions`/`rollFlowActionsMulti` reproduisent
// EXACTEMENT le même ensemble de clés (le store passe la liste des verbes voulus) sans rien
// recopier ; le runtime est byte-identique (mêmes appels `FLOWS.<x>.<m>(get, set[, …])`).

/** Les verbes du cycle de jet différé (cf. `RollFlowHandlers`). `resist` = Résistance (Menace),
 *  LDB 10 — exposé par les seuls flux à `caps.resist` (Tests qui « résistent à une menace »).
 *  `cancel` = « Annuler » unifié (cascade-aware + `onCancel` métier) — exposé par les flux annulables ;
 *  sans `pid` (annuler ferme la modale/cascade entière, pas un slot). */
export type RollVerb = 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll' | 'resist' | 'determine' | 'cancel';

const capitalize = <S extends string>(s: S): Capitalize<S> =>
  (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<S>;

/** Délégués MONO : `setForcedRoll` prend `(roll)`, les autres `()`. Clé = `${prefix}${Verbe}`. */
export type MonoRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (roll: number) => void : () => void;
};
/** Délégués MULTI : `pid` en tête (slot ciblé) ; `setForcedRoll` prend `(pid, roll)` ; `cancel` reste
 *  sans argument (il ferme la situation entière, pas un participant). */
export type MultiRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (pid: string, roll: number) => void : K extends 'cancel' ? () => void : (pid: string) => void;
};

/** Délégués MONO d'un flux : les verbes listés, byte-identiques aux anciens `() => FLOWS.x.m(get, set)`. */
export function rollFlowActions<P extends string, const A extends readonly RollVerb[]>(
  prefix: P, flow: RollFlowHandlers, get: Get, set: Set, verbs: A,
): MonoRollActions<P, A[number]> {
  const out: Record<string, (roll?: number) => void> = {};
  for (const v of verbs) {
    out[`${prefix}${capitalize(v)}`] = v === 'setForcedRoll'
      ? (roll?: number) => flow.setForcedRoll(get, set, roll as number)
      : () => flow[v](get, set);
  }
  return out as MonoRollActions<P, A[number]>;
}

/** Délégués MULTI d'un flux : `pid` en tête, byte-identiques aux anciens `(pid) => FLOWS.x.m(get, set, pid)`. */
export function rollFlowActionsMulti<P extends string, const A extends readonly RollVerb[]>(
  prefix: P, flow: RollFlowHandlers, get: Get, set: Set, verbs: A,
): MultiRollActions<P, A[number]> {
  const out: Record<string, (a?: string | number, b?: number) => void> = {};
  for (const v of verbs) {
    out[`${prefix}${capitalize(v)}`] = v === 'setForcedRoll'
      ? (pid?: string | number, roll?: number) => flow.setForcedRoll(get, set, roll as number, pid as string)
      : v === 'cancel'
        ? () => flow.cancel(get, set) // « Annuler » ferme la situation entière (pas de `pid`)
        : (pid?: string | number) => flow[v](get, set, pid as string);
  }
  return out as MultiRollActions<P, A[number]>;
}

// `RollFlowActionsMap` (surface EXACTE des délégués de jet du store) est DÉRIVÉE de `FLOW_WIRING` —
// voir sa définition en bas de fichier (après la table). Fin de la recopie à la main des 36 lignes.

/** Spec PARTAGÉE des Tests d'équipage MULTI (MDG ch.14) : un jet PAR RÔLE tenu (`rollCrewRole`), Résilience
 *  = DR max du contributeur (`forceCrewRole`), Chance « +1 DR » sur SON jet. Consommée par les 3 flux jumeaux
 *  (manœuvre / bordée / Test d'équipage générique) — la spec n'est écrite qu'UNE fois. */
function crewRoleFlowSpec<P extends import('./rollFlowFactory').PendingBase & { participants: ShipManeuverParticipant[] }>(
  key: 'pendingShipManeuver' | 'pendingShipBattery' | 'pendingCrewTest',
): import('./rollFlowFactory').RollFlowSpec<P, ShipManeuverParticipant> {
  return {
    key,
    multi: { slots: (p) => p.participants, idOf: (r) => r.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (r) => !!r.result,
    actor: (s, r) => actorIn(s, r.id),
    caps: { forced: true },
    resolve: (_s, r, actor, _get, forced) => {
      if (!actor) return null;
      const rr = forced ? forceCrewRole(actor, r.roleId, r.cumul, r.sense) : rollCrewRole(actor, r.roleId, battleRng(), r.cumul, r.sense);
      return rr ? { result: rr } : null;
    },
    outcome: (r) => cleanRollOutcome(r.result), // d100 propre réussi (roll ≤ cible)
    // Chance « +1 DR » sur CE contributeur (LDB 17 l.26).
    bonus: { derive: (_s, r) => bumpResultSL(r) },
  };
}

/** Une Activité/Scène de bataille est-elle GAGNÉE ? Test COMBINÉ (l.75/102) : `full` seulement — un
 *  `partial` (skill-1 réussie mais skill-2 ratée) est un ÉCHEC GLOBAL RAW (LDB 12 l.229). Tenue (l.161,
 *  Test opposé) et cas simple → le `success` du résolveur (opposition `enemySL ≤ 0` / réussite numérique).
 *  Gouverne le GARDE de la Résilience (rien à forcer si déjà gagné), en écho au `failed` du flux `activity`. */
function activityWon(p: PendingActivity): boolean {
  return p.combinedLevel != null ? p.combinedLevel === 'full' : p.success;
}

// ── Fabriques d'ISSUE CANONIQUE (cf. `TestOutcome`) — les DEUX formes récurrentes, écrites UNE fois.
//    Chaque flux passe SON champ de résultat ; les cas particuliers (attaque/opposition/DR de Course/
//    Focalisation…) gardent leur `outcome` explicite en dessous. ──

/** Choke-point PARTAGÉ du scellement (#275 Décision 2) : reconstruit le `TestResult` minimal exigé par
 *  `TestOutcome.seal` depuis les formes hétérogènes de résultat des flux — `isDouble` n'est jamais tracé
 *  ICI (non lu par `TestOutcome`, cf. `engine/testOutcome.ts`). `detail` transite TEL QUEL quand le flux
 *  possède un vrai `RollBreakdown` (attaque/défense/piétinement…) — jamais fabriqué de toutes pièces. */
const sealOutcome = (won: boolean, sl: number, roll = 0, target = 0, detail?: RollBreakdown): TestOutcome =>
  TestOutcome.seal({ roll, target, success: won, sl, isDouble: false }, detail);

/** Issue d'un Test dont le résultat est déjà un `{ success, sl }` (jet simple ou opposé résolu) : la
 *  réussite RÉELLE + son Degré. Couvre défense/désengagement/agrippe/battement/manœuvre/psy/dissipation… */
const testOutcome = (r: { roll?: number; target?: number; success?: boolean; sl?: number } | null | undefined): TestOutcome =>
  sealOutcome(!!r?.success, r?.sl ?? 0, r?.roll ?? 0, r?.target ?? 0);

/** Issue d'un Test dont on lit le d100 BRUT (réussite propre = `roll ≤ cible`, LDB 12) + son DR — les
 *  flux qui gatent la Chance sur le jet propre (soin/rechargement/évaluation/marchandage/corruption…). */
const rollOutcome = (roll: number | null | undefined, target: number, sl: number | null | undefined): TestOutcome =>
  sealOutcome((roll ?? 0) <= target, sl ?? 0, roll ?? 0, target);

/** Issue d'un Test dont le résultat est un `{ roll, target, sl }` SANS champ `success` (réussite propre
 *  = `roll ≤ cible`) : incantation, enfoncement de porte, Test d'équipage — un résultat absent = échec. */
const cleanRollOutcome = (r: { roll: number; target: number; sl?: number } | null | undefined): TestOutcome =>
  sealOutcome(!!r && r.roll <= r.target, r?.sl ?? 0, r?.roll ?? 0, r?.target ?? 0);

/** Réussite forcée d'un Test BINAIRE (Résilience « Je ne faillirai pas ! », LDB 17 l.73) : renvoie le
 *  `{ success, roll, target, sl }` forcé — avant le jet (pas de résultat → dé 01), ou après un échec
 *  (réussite au DR courant, planché à 0) — ou `null` si le Test est DÉJÀ réussi (rien à forcer). Partagé
 *  par Frénésie/Approche/Bénédiction (sur `p.result`) et Fuir (sur son sous-jet `p.fuir.calme`). */
const forcedBinarySuccess = (r: { success?: boolean; roll?: number; target?: number; sl?: number } | null | undefined) =>
  r?.success ? null : { success: true, roll: r?.roll ?? 1, target: r?.target, sl: Math.max(r?.sl ?? 0, 0) };

/** Réussite forcée BINAIRE d'un flux dont le jet vit sous `result` (Frénésie/Approche/Bénédiction) :
 *  `{ result }` ou `null` si le Test est DÉJÀ réussi — l'emballage `result` partagé par les 3 branches `if (forced)`. */
const forcedBinaryResult = (r: { success?: boolean; roll?: number; target?: number; sl?: number } | null | undefined) => {
  const f = forcedBinarySuccess(r);
  return f ? { result: f } : null;
};

/** Chance « +1 DR » d'un slot dont le jet vit sous `result` (`{ …, sl }`, jamais opposé) : `bumpSL` du seul
 *  DR, `success`/`roll` INTACTS (LDB 17 l.84 : un Degré de plus ne transforme pas un échec en réussite).
 *  `null` = pas encore lancé (rien à améliorer). Partagé par les flux `result` NON opposés (Test d'équipage /
 *  Test Étendu / cascade simple) dont le `bonus.derive` répétait `{ result: { ...r.result, sl: r.result.sl + 1 } }`. */
const bumpResultSL = <R extends { sl: number }>(slot: { result?: R | null }): { result: R } | null =>
  slot.result ? { result: { ...slot.result, sl: slot.result.sl + 1 } } : null;

/** Lentille PARTAGÉE des Tests PLATS (le jet vit au niveau du pending : `roll`/`target`/`sl`/`success`) —
 *  `actorTR` reconstruit le TestResult, `applyRoll` re-projette roll/sl/success (identiques d'un flux à
 *  l'autre) ; seul `dieTarget` (cible du dé forcé ; `null` = déjà réussi → rien à forcer) varie. Soin/
 *  Chirurgie/Rechargement/Évaluation. Chance « +1 DR » par `bumpSL` (success intact), Résilience LDB 17 l.68. */
const flatRollLens = <P extends import('./rollFlowFactory').PendingBase & { roll: number | null; target: number; sl: number; success: boolean }>(
  dieTarget: (p: P) => number | null,
): RollFlowLens<P> => ({
  actorTR: (p) => p.roll != null ? hydrateTR({ roll: p.roll, target: p.target, success: p.success, sl: p.sl }) : null,
  applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, sl: tr.sl, success: tr.success } as Partial<P>),
  dieTarget,
});

/** Lentille PARTAGÉE des Tests dont le jet vit sous `p.result` (`{ roll, target, sl, success }`) — même
 *  `actorTR`/`applyRoll` que `flatRollLens` mais imbriqués sous `result` ; seul `dieTarget` varie (Chanson/Dissipation). */
const resultRollLens = <P extends import('./rollFlowFactory').PendingBase & { result: { roll: number; target: number; sl: number; success: boolean } | null | undefined }>(
  dieTarget: (p: P, actor: Combatant) => number | null,
): RollFlowLens<P> => ({
  actorTR: (p) => p.result ? hydrateTR(p.result) : null,
  applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: { roll: tr.roll, target: tr.target, success: tr.success, sl: tr.sl } } as Partial<P>),
  dieTarget,
});

/** Fabrique PARTAGÉE des Tests opposés BINAIRES (issue success/tie/fail) où SEUL le jet de l'ACTEUR se
 *  (re)joue tandis que le foe reste FIGÉ — le jet de l'acteur est l'« attaquant » du Test opposé
 *  (`resolveOpposed`/`disengageOutcome`). Désengagement (Esquive), Au Contact (Corps à corps), Empoignade
 *  (Force), Distraire (Athlétisme) : ces flux ne différaient QUE par le champ du jet acteur, la fonction
 *  de jet et le champ du foe figé (les commentaires les appelaient « CALQUE EXACT »). Chance « +1 DR »
 *  re-oppose (lentille `bumpSL`) ; Résilience « Je ne faillirai pas ! » = l'emporter (issue 'success'). */
function opposedBinaryFlow<P extends import('./rollFlowFactory').PendingBase & { result?: unknown }>(cfg: {
  key: keyof GameState & string;
  actorId: (p: P) => string;
  rollActor: (actor: Combatant) => TestResult;
  /** Jet de l'ACTEUR : lecture (`p.def` — Désengagement/Au Contact/Empoignade ; `p.atk` — Distraire) et pose. */
  actorTR: (p: P) => TestResult | null | undefined;
  putActorTR: (tr: TestResult) => Partial<P>;
  /** Jet FIGÉ du foe (`p.atk` ; `p.defRoll` pour Distraire). */
  foeTR: (p: P) => TestResult | null | undefined;
  /** Le jet a-t-il été lancé ? Défaut : le jet de l'acteur est posé. */
  rolled?: (p: P) => boolean;
}): RollFlowHandlers {
  const opposedPatch = (p: P, tr: TestResult): Partial<P> => {
    const foe = cfg.foeTR(p)!; // présent sur tous les chemins (resolve garde `foeTR != null` ; applyRoll = post-jet)
    return { ...cfg.putActorTR(tr), result: disengageOutcome(resolveOpposed(tr, foe).winner) } as Partial<P>;
  };
  return makeRollFlow<P>({
    key: cfg.key,
    rolled: cfg.rolled ?? ((p) => cfg.actorTR(p) != null),
    actor: (s, p) => actorIn(s, cfg.actorId(p)),
    caps: { forced: true },
    resolve: (_s, p, actor) => (actor && cfg.foeTR(p) != null ? opposedPatch(p, cfg.rollActor(actor)) : null),
    outcome: (p) => testOutcome(cfg.actorTR(p)),
    lens: {
      actorTR: (p) => cfg.actorTR(p) ?? null,
      applyRoll: (_s, slot, _actor, _get, tr) => opposedPatch(slot, tr),
      forceWin: (slot, _actor, tr) => (slot.result && tr ? ({ result: 'success' as const } as Partial<P>) : null),
    },
  });
}

/**
 * Cœur PARTAGÉ du jet d'un Test SIMPLE (jet vs cible unique, LDB 12) : `rollTest(valeur, Difficulté, rng)`
 * → le TestResult à 4 champs `{roll,target,sl,success}` (ou `null` sans acteur). `value` lit le pending +
 * l'acteur ; `difficulty` fixe ou fonction du pending (défaut Intermédiaire, +0) ; `rng` = le générateur
 * COURANT du flux (combat → `battleRng` ; hors-combat → `defaultRNG`) — PARAMÉTRÉ, pas imposé, pour que
 * chaque flux garde SON jet byte-identique (le rng d'un Test est CONTEXTUEL, on ne le normalise pas). Les
 * 3 poses ci-dessous (FLAT / `result` / `fuir.calme` de `flee`) ne diffèrent QUE par l'ENDROIT où elles
 * rangent ce résultat : un Test DÉCLARE sa valeur, sa Difficulté et son rng — il n'a PAS à re-coder sa
 * résolution. Cf. `opposedBinaryFlow` pour les Tests OPPOSÉS.
 *
 * `actorless` : le Test roule sur une valeur BAKÉE (`p.skillValue` fixé à l'ouverture) → il n'a PAS besoin
 * d'un acteur LIVE, car le lanceur peut être HORS du champ d'`actorIn` (Soin/Chirurgie par un Médecin PNJ
 * de scène : `healerId` absent des combattants). Sans le drapeau, un acteur absent ANNULE le jet (défaut
 * conservateur des Tests dont la VALEUR vient de l'acteur : Calme/FM/`testValue`). L'INFLUENCE
 * (Chance/Résilience) reste gérée à part par la fabrique via `spec.actor` (no-op si l'acteur est un PNJ).
 */
function simpleRoll<P extends PendingBase>(
  p: P, actor: Combatant | undefined,
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty),
  rng: () => RNG,
  opts?: { actorless?: boolean },
): { roll: number; target: number; sl: number; success: boolean } | null {
  if (!actor && !opts?.actorless) return null; // Test à valeur d'acteur : pas d'acteur live → pas de jet
  const t = rollTest(value(p, actor as Combatant), typeof difficulty === 'function' ? difficulty(p) : difficulty, rng());
  return { roll: t.roll, target: t.target, sl: t.sl, success: t.success };
}

/** Chemin NORMAL d'un Test simple, jet APLATI au niveau du pending. Un flux à branche `forced`/`bonus`
 *  garde ces branches et ne délègue QUE son chemin normal. Cast large : les pendings portent ces champs
 *  sous des formes hétérogènes (certains `target`/`sl` optionnels — PendingCorruption) → un `P` étroit les
 *  exclurait ; la contrainte de forme est portée par le flux. */
const simpleTestResolve = <P extends PendingBase>(
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty) = 'intermediaire',
  rng: () => RNG = battleRng,
  opts?: { actorless?: boolean },
) => (_s: GameState, p: P, actor: Combatant | undefined): Partial<P> | null =>
  simpleRoll(p, actor, value, difficulty, rng, opts) as unknown as Partial<P> | null;

/** Idem mais le jet vit sous `result` (même distinction FLAT vs `result` que `flatRollLens`/`resultRollLens`).
 *  Pas d'`actorless` : les flux `result` migrés (dispel/shanty/approach/ward) ont TOUS un acteur LIVE. */
const simpleTestResultResolve = <P extends PendingBase>(
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty) = 'intermediaire',
  rng: () => RNG = battleRng,
) => (_s: GameState, p: P, actor: Combatant | undefined): Partial<P> | null => {
  const r = simpleRoll(p, actor, value, difficulty, rng);
  return r ? ({ result: r } as unknown as Partial<P>) : null;
};

export const FLOWS = {
  /**
   * Attaque (modale différée). Le JET INITIAL reste métier (`attackRoll` : +1 Avantage si cible
   * Sonnée, annulation hors portée/LdV, victime de déviation dans la mêlée) — comme `attackConfirm`.
   * Le cycle Chance/Pacte/Résilience/dé choisi vit ICI, identique à tous les flux.
   */
  attack: makeRollFlow<PendingAttack>({
    key: 'pendingAttack',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    // Résolveur UNIQUE (`caps.forced`) : jet normal (relance Chance/Pacte = re-résolution complète,
    // mêmes environnement et options de tir) OU Résilience (LDB 17 l.73) selon `forced`.
    // Dé choisi (`picker`) : le d100 de l'attaquant — son inverse donne la localisation (LDB 13 l.142).
    caps: {
      forced: true,
      picker: (p) => (p.forced && p.result?.attackerDetail ? { roll: p.result.attackerRoll, target: p.result.attackerDetail.target } : null),
    },
    resolve: (s, p, actor, get, forced) => {
      const target = actorIn(s, p.targetId);
      if (!actor || !target) return null;
      if (forced) {
        const ad = p.result?.attackerDetail;
        if (!ad) return null; // (ancien `force.guard : !!p.result?.attackerDetail`)
        // Test opposé : « vous l'emportez avec au moins DR +1 » (LDB 17 l.73).
        const defSL = p.result!.defenderDetail?.sl ?? 0;
        if (forced.roll != null) {
          // Dé CHOISI : 11 → Coup Critique (l'exemple Salundra l.75) ; 01 → DR max ; les unités
          // nourrissent Percutante/Dévastatrice et la localisation inversée. Doit RESTER une réussite.
          if (forced.roll > maxForcedRoll(ad.target)) return null;
          const sl = Math.max(evaluateTest(forced.roll, ad.target).sl, defSL + 1, 1);
          const atk2 = forcedTR(forced.roll, ad.target, sl);
          return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
        }
        // Dé PAR DÉFAUT : on garde le jet courant, forcé à l'emporter.
        const atk2 = forcedTR(ad.roll, ad.target, Math.max(ad.sl, defSL + 1, 1));
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      }
      const r = resolveAttack(get, actor, target, p.location ?? undefined, p.fromCharge, p.intoCrowd, p.heldGround, p.weaponUid, p.withhold);
      return r ? { result: r.res, victimId: r.victim?.id } : null;
    },
    // Issue CANONIQUE : l'attaquant l'emporte (`attackerDetail.success`). La 2ᵉ frappe du Maniement de
    // deux armes est un jet IMPOSÉ (d100 inversé) — ni relance ni Pacte : `won:true` verrouille son gating.
    outcome: (p) => sealOutcome(!!p.dualSecond || !!p.result?.attackerDetail?.success, p.result?.attackerDetail?.sl ?? 0, p.result?.attackerDetail?.roll ?? 0, p.result?.attackerDetail?.target ?? 0, p.result?.attackerDetail),
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2 = bumpSL(hydrateTR(ad));
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      },
    },
    // « Annuler » : défaire la charge misclic AVANT le jet
    // (positions/orientation/Mouvement/Avantage +1 rendu/chargedThisTurn), no-op sur une 2ᵉ frappe
    // imposée, fin de balayage pour un cleave, sinon fermeture (+ cascade combat étape 0).
    onCancel: (get, set) => {
      const pa = get().pendingAttack;
      if (pa?.dualSecond) return; // 2ᵉ frappe d'un dual : engagée dès que la cible est choisie (le jet est imposé)
      // Charge : Annuler AVANT tout jet (`result===null`) DÉFAIT le misclic — comme annuler un déplacement,
      // mais pour la manœuvre combinée « déplacement + attaque ». On restaure positions, orientation, Mouvement,
      // Avantage (+1 de charge rendu) et `chargedThisTurn`. Une fois le dé lancé, la charge est ENGAGÉE (RAW LDB 15).
      if (pa?.fromCharge) {
        const battle = get().battle;
        if (pa.result || !pa.chargeUndo || !battle) { if (!pa.result) set({ pendingAttack: null }); return; } // dé lancé → engagé (pas d'undo)
        const u = pa.chargeUndo;
        for (const c of battle.combatants) { const p = u.pos[c.id]; if (p) c.pos = { ...p }; } // restaure TOUS (un grand a pu en déplacer d'autres)
        const attacker = inBattleId(battle, pa.attackerId);
        if (attacker) { attacker.gainedAdvThisRound = u.gainedAdvBefore; attacker.chargedThisTurn = u.chargedBefore; if (u.advGained) campSpend(get, attacker, u.advGained); } // rend le +1 Avantage de la charge
        set({ facing: { ...u.facing }, battle: { ...battle, movementUsed: u.movementUsed, movedPreAction: u.movedPreAction, action: null, reachable: new Map(), preview: null }, pendingAttack: null });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      if (pa?.cleave) { set({ pendingAttack: null }); return get().cleaveEnd(); } // annuler = terminer le balayage (cleaveEnd clôt la cascade)
      // Annuler ferme aussi la séquence-jet de combat (étape 0 non encore validée).
      const seq = get().pendingCascade;
      const closeSeq = seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack';
      set({ pendingAttack: null, ...(closeSeq ? { pendingCascade: null } : {}) });
    },
  }),

  /**
   * Défense réactive (héros attaqué par l'IA) : le jet d'attaque (`p.atk`) reste FIGÉ ; seul le jet
   * du défenseur se (re)joue. `defenseConfirm` (reprise du tour IA) reste au store. PAS de « Subir » :
   * le RAW n'offre aucune non-défense volontaire (mêlée = Test opposé, LDB 13 l.123) — la résolution
   * non opposée est réservée aux cas IMPOSÉS (Surpris/Inconscient/Fuir/inanimé), traités hors de ce flux.
   */
  defense: makeRollFlow<PendingDefense>({
    key: 'pendingDefense',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.defenderId),
    // Résolveur UNIQUE (`caps.forced`) : seul le jet du défenseur se (re)joue (`p.atk` figé).
    caps: {
      forced: true,
      picker: (p) => (p.forced && p.def ? { roll: p.def.roll, target: p.def.target } : null),
    },
    resolve: (s, p, actor, _get, forced) => {
      const attacker = actorIn(s, p.attackerId);
      if (!attacker || !actor) return null;
      const mpt = sceneMetresPerTile(s.scene);
      if (forced) {
        const dd = p.result?.defenderDetail;
        if (!dd || !p.def) return null; // (ancien `force.guard`)
        if (forced.roll != null) {
          // Dé CHOISI — doit RESTER une réussite.
          if (forced.roll > maxForcedRoll(p.def.target)) return null;
          const sl = Math.max(evaluateTest(forced.roll, p.def.target).sl, p.atk.sl + 1, 1);
          const def2 = forcedTR(forced.roll, p.def.target, sl);
          return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, undefined, mpt) };
        }
        // Dé PAR DÉFAUT : Test opposé « vous l'emportez avec au moins DR +1 » (LDB 17 l.73).
        const def2 = forcedTR(dd.roll, dd.target, Math.max(dd.sl, p.atk.sl + 1, 1));
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, undefined, mpt) };
      }
      // Neige −20 + cavalier −20 (LDB 14 l.115-116/225) ; Rapide : −10 à la parade d'une arme non-Rapide (LDB 62 l.320).
      const dodgeMod = (s.scene ? sceneCombatModifiers(s.scene, s.gameTime).dodgeMod : 0) + mountedDodgePenalty(actor);
      const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
      const def = rollMeleeDefender(actor, p.mode, battleRng(), dodgeMod, parry, p.weapon, defenseSubOf(actor, p));
      return { def, result: finishDefenseResult(attacker, actor, p, def, dodgeMod, parry, mpt) };
    },
    outcome: (p) => testOutcome(p.def),
    bonus: {
      guard: (p) => !!p.result?.defenderDetail,
      derive: (s, p, actor) => {
        const attacker = actorIn(s, p.attackerId);
        if (!attacker) return null;
        const dd = p.result!.defenderDetail!;
        const def2 = bumpSL(hydrateTR(dd));
        const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, parry, sceneMetresPerTile(s.scene)) };
      },
    },
  }),

  /**
   * Incantation / Prière. Le JET INITIAL reste métier (`castRoll` : wards journalisés,
   * Surincantation automatique de l'IA, déclaration de Contre-sort ennemi) — le cycle
   * Chance/Pacte/Résilience/dé choisi vit ici.
   */
  cast: makeRollFlow<PendingCast>({
    key: 'pendingCast',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    // Résolveur UNIQUE (`caps.forced`) : jet normal (Relance Chance/Pacte) OU Résilience (LDB 17
    // l.73) selon `forced` — plus de dérives `force`/`forceRoll` séparées. La localisation d'un
    // Projectile suit le dé inversé (LDB 46 l.156) : choisir le dé via `forced.roll` la re-dérive.
    // Picker : 11 → Incantation Critique seulement pour un sort (les Prières n'ont pas de Critique).
    caps: {
      forced: true,
      picker: (p) => {
        if (!p.forced || !p.result || p.result.target <= 0) return null;
        const spell = effectiveSpellOf(p);
        return { roll: p.result.roll, target: p.result.target, critable: !(spell && castInfoIsPrayer(spell)) };
      },
    },
    resolve: (s, p, actor, _get, forced) => {
      const target = actorIn(s, p.targetId);
      const spell = effectiveSpellOf(p); // NI ×2 si lecture au grimoire (LDB 47 l.34)
      if (!actor || !target || !spell) return null;
      if (forced) {
        // — Résilience « vous choisissez le résultat » (LDB 17 l.73), seulement APRÈS le jet —
        const cur = p.result;
        if (!cur) return null; // (ancien `force.guard : !!p.result` : rien à forcer sans jet)
        const ni = p.focused ? 0 : spell.cn ?? 0;
        if (forced.roll != null) {
          // Dé CHOISI (setForcedRoll) : 11 → Incantation Critique ; 01 → DR max → Surincantation.
          if (forced.roll > maxForcedRoll(cur.target)) return null; // doit RESTER une réussite
          const sl = evaluateTest(forced.roll, cur.target).sl
            + castTestTalentDR(actor, castInfoIsPrayer(spell) ? 'priere' : 'langue', castInfoIsPrayer(spell) ? undefined : 'magick');
          return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: forced.roll, sl }, p.missile, p.focused, Math.max(0, ni - sl)) };
        }
        // Dé PAR DÉFAUT (forceSuccess) — plancher : le sort PART (DR ≥ NI), d100 propre réussi.
        return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, p.missile, p.focused, Math.max(1, ni - cur.sl)) };
      }
      // — Jet NORMAL (relance Chance/Pacte) : re-jet complet — wards recalculés (Sorcière LDB 42 + Aqshy LDB 48). —
      // Ward = pénalité « Sorcière » (LDB 42) + bonus conditionnel de Domaine (Aqshy près des flammes,
      // LDB 48) + bonus d'ENVIRONNEMENT (Vie/Ghyran +10 en zone rurale/sauvage, LDB 48 l.690).
      const ward = castWardPenalty(s, target, spell) + domainCastBonus(s, actor, spell) + domainEnvironmentBonus(spell, s.scene?.environment);
      // « Prêchez, ma sœur ! » (LDB 40 l.40-42, option `prayer-conviction`) : une Prière murmurée
      // subit une Difficulté d'un cran plus dure. Ne concerne QUE les Prières (`castInfoIsPrayer`).
      const discreet = !!p.discreet && castInfoIsPrayer(spell) && !!rule('prayer-conviction');
      const difficulty = discreetPrayerDifficulty('intermediaire', discreet);
      const res = p.missile
        ? resolveMagicMissile(actor, target, spell, battleRng(), p.focused, ward, seaMagicContext(s))
        : resolveCasting(actor, spell, battleRng(), difficulty, p.focused, ward, seaMagicContext(s));
      return { result: res };
    },
    // Issue CANONIQUE = d100 propre réussi (roll ≤ cible) — relance/Pacte alignés sur le jet propre.
    outcome: (p) => cleanRollOutcome(p.result),
    bonus: {
      // Chance « +1 DR » : peut franchir le NI, cumulable.
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        const spell = effectiveSpellOf(p);
        if (!target || !spell) return null;
        return { result: rederiveCastSL(actor, target, spell, p.result!, p.missile, p.focused, 1) };
      },
    },
  }),

  /**
   * Contre-sort à PLUSIEURS (Dissipation, LDB 46 l.201-202/207) — flux MULTI : le jet d'incantation
   * ENNEMI est figé (`p.cast`) ; chaque héros choisi oppose son Langue (Magick), avec son PROPRE
   * cycle Chance/+1 DR/Pacte/Résilience. `resolve` consomme l'essai du Round (l.202). L'agrégat
   * (dissipé si UN gagne, sinon meilleur DR net) vit dans `counterspellConfirm` (store).
   */
  counterspell: makeRollFlow<PendingCounterspell, CounterParticipant>({
    key: 'pendingCounterspell',
    // PARALLÈLE : chaque participant est un héros contre-lanceur (slot indépendant).
    multi: { slots: (p) => p.participants, idOf: (part) => part.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (part) => !!part.result,
    actor: (s, part) => actorIn(s, part.id),
    // Le jet d'incantation ENNEMI vit dans `pendingCast` (figé) ; le participant oppose son Langue
    // (Magick). Jet NORMAL (RNG) ou Résilience (`forced`).
    resolve: (s, part, actor, _get, forced) => {
      const pcCast = s.pendingCast?.result;
      if (!actor || !pcCast) return null;
      const castT = castTestOf(pcCast);
      actor.dispelledThisRound = true; // « un seul Sort chaque Round » (l.202) — consommé même raté
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : le Contre-sort l'emporte (dissipe). Rien à forcer si déjà dissipé.
        const cur = part.result;
        if (cur?.dispelled) return null;
        const value = castingValue(actor, 'langue', 'magick');
        const roll = cur ? cur.counter.roll : 1; // 01 = jet propre garanti (LDB 17 l.73)
        const sl = Math.max(cur?.counter.sl ?? 1, castT.sl + 1, 1);
        const counterT = forcedTR(roll, value, sl);
        return { result: counterspellOutcomeFrom(actor, counterT, castT) };
      }
      return { result: resolveCounterspell(actor, castT, battleRng()) };
    },
    // Issue CANONIQUE : le Contre-sort du contre-lanceur RÉUSSIT (son jet propre passe) → sinon Chance (LDB 12).
    outcome: (part) => testOutcome(part.result?.counter),
    caps: { forced: true }, // Résilience GLOBALE (pas de choix du dé : un Contre-sort gagnant suffit)
    bonus: {
      // Chance « +1 DR » : améliore le DR du Contre-sort, peut basculer l'opposition (LDB 17 l.26).
      derive: (s, part, actor) => {
        const pcCast = s.pendingCast?.result;
        const cur = part.result;
        if (!cur || !pcCast) return null;
        const counterT = bumpSL(cur.counter);
        return { result: counterspellOutcomeFrom(actor, counterT, castTestOf(pcCast)) };
      },
    },
  }),

  /**
   * Incantation OPPOSÉE (Fauche-démon → FM, Parole de Tzeentch → Intelligence) — flux MULTI : le jet
   * d'incantation est FIGÉ (`pendingCast.result`) ; chaque CIBLE oppose son Test, avec son propre cycle
   * Chance/+1 DR/Pacte/Résilience. `oppositionConfirm` agrège (résisté + marge de DR par cible). Cible
   * IA = rangée témoin (jet auto-roulé à l'ouverture, openCastOpposition).
   */
  castOpposition: makeRollFlow<PendingCastOpposition, OppositionParticipant>({
    key: 'pendingCastOpposition',
    multi: { slots: (p) => p.participants, idOf: (part) => part.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (part) => !!part.result,
    actor: (s, part) => actorIn(s, part.id),
    resolve: (s, part, actor, _get, forced) => {
      const pcCast = s.pendingCast?.result;
      const pco = s.pendingCastOpposition;
      if (!actor || !pcCast || !pco) return null;
      const castT = castTestOf(pcCast); // l'incantation figée = l'« attaquant » de l'opposition
      const oppVal = testValue(actor, pco.skill, pco.char); // FM / Intelligence de la cible
      if (forced?.sl != null) {
        // Résistance (Magie), LDB 10 l.1015-1021 : le Test pour résister au Sort réussit d'office —
        // la cible RÉSISTE (interprétation : « réussir le Test pour résister » = l'opposition est
        // tenue), DR imposé = Bonus d'Endurance (nourrit la marge).
        const oppose = forcedTR(1, oppVal, forced.sl); // dé 01 → double=false → identique à l'ancien littéral
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - forced.sl) } };
      }
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : la cible force sa réussite → résiste (l'emporte).
        const cur = part.result;
        const roll = cur ? cur.oppose.roll : 1; // 01 = jet propre garanti (LDB 17 l.73)
        const sl = Math.max(cur?.oppose.sl ?? 1, castT.sl + 1, 1);
        const oppose = forcedTR(roll, oppVal, sl);
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - sl) } };
      }
      const oppose = rollTest(oppVal, 'intermediaire', battleRng());
      const o = resolveOpposed(castT, oppose);
      return { result: { oppose, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - oppose.sl) } };
    },
    // Issue CANONIQUE : la cible RÉSISTE au sort (`resisted`) ; sinon le lanceur l'emporte → SA Chance (héros défenseur).
    outcome: (part) => sealOutcome(!!part.result?.resisted, part.result?.oppose.sl ?? 0, part.result?.oppose.roll ?? 0, part.result?.oppose.target ?? 0),
    // `resist` : « résister aux sorts » = la menace 'Magie' du talent (tag posé par openCastOpposition).
    caps: { forced: true, resist: true },
    bonus: {
      derive: (s, part, actor) => {
        const pcCast = s.pendingCast?.result;
        const cur = part.result;
        if (!cur || !pcCast || !actor) return null;
        const castT = castTestOf(pcCast);
        const oppose = bumpSL(cur.oppose);
        const o = resolveOpposed(castT, oppose);
        return { result: { oppose, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - oppose.sl) } };
      },
    },
  }),

  /**
   * Test Étendu (LDB 12 l.197-211) — flux multi SÉQUENTIEL : un Round à la fois, chacun son cycle
   * Chance/+1 DR/Pacte/Résilience. Ici `resolve` ne fait QUE le jet du Round ; le CUMUL du DR (et la
   * dépendance au total des Rounds précédents) vit dans `extendedTestNext` (store). Même fabrique
   * que le Contre-sort PARALLÈLE — seule la progression (un slot après l'autre) change.
   */
  extendedTest: makeRollFlow<PendingExtendedTest, ExtendedTestRound>({
    key: 'pendingExtendedTest',
    multi: { slots: (p) => p.rounds, idOf: (r) => r.id, replace: (p, rounds) => ({ ...p, rounds }) },
    rolled: (r) => !!r.result,
    actor: (s, _r, p) => (p ? actorIn(s, p.actorId) : undefined),
    resolve: (_s, _r, _actor, _get, forced, p) => {
      if (!p) return null;
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : Round garanti réussi (dé MEILLEUR → DR max), LDB 17 l.73.
        const die = bestForcedRoll(p.target);
        return { result: { roll: die, sl: evaluateTest(die, p.target).sl, success: true } };
      }
      // Cible déjà ajustée à la difficulté → Test « +0 » sur `p.target`.
      const t = rollTest(p.target, 'intermediaire', battleRng());
      return { result: { roll: t.roll, sl: t.sl, success: t.success } };
    },
    outcome: (r) => testOutcome(r.result),
    caps: { forced: true },
    bonus: {
      derive: (_s, r) => bumpResultSL(r),
    },
  }),

  /**
   * CASCADE séquentielle (jets de NUIT / VOYAGE) — flux multi SÉQUENTIEL générique : une étape à la
   * fois (l'étape courante = `participants[cursor]`), chacune son cycle Chance/+1 DR/Pacte/Résilience.
   * Le JET est kind-agnostique (Test « +0 » sur `step.target`, difficulté déjà appliquée) ; la
   * CONSÉQUENCE par `kind` + l'avancée du curseur vivent dans `cascadeNext`/`advanceCascade`
   * (state/cascade.ts). Même fabrique que le Test Étendu — seule la sémantique d'étape change.
   */
  cascade: makeRollFlow<PendingCascade, CascadeStep>({
    key: 'pendingCascade',
    multi: { slots: (p) => p.participants, idOf: (st) => st.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (st) => !!st.result,
    actor: (s, st) => (st.actorId ? actorIn(s, st.actorId) : undefined),
    resolve: (_s, st, _actor, _get, forced) => {
      if (st.target == null) return null; // étape sans jet → rien à lancer
      const opp = st.meta?.opposed; // Test OPPOSÉ figé (Assommante) → l'issue vient de resolveOpposed.
      if (forced?.sl != null) {
        // Résistance (Menace), LDB 10 l.1015-1021 : auto-succès du Test de l'étape (Contraction,
        // Exposition à la Corruption, Venin…) — DR IMPOSÉ = Bonus d'Endurance (pas de choix du dé).
        return { result: { roll: 1, target: st.target, sl: forced.sl, success: true } };
      }
      if (forced) {
        // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : « au lieu de lancer les dés, vous
        // choisissez le résultat ». Dé CHOISI (`forced.roll`, picker des Peurs étendues — le DR gagné
        // suit le dé) sinon dé PAR DÉFAUT (01 → DR maximal). Le choix doit RESTER une réussite. En Test
        // OPPOSÉ, le défenseur RÉSISTE (binaire, comme `disengage` forcé) — l'attaquant figé ne l'emporte plus.
        const die = forced.roll != null ? Math.min(Math.max(1, forced.roll), maxForcedRoll(st.target)) : bestForcedRoll(st.target);
        const e = evaluateTest(die, st.target);
        return { result: { roll: die, target: st.target, sl: e.sl, success: true } };
      }
      const t = rollTest(st.target, 'intermediaire', battleRng());
      // Test OPPOSÉ : l'issue success/sl du défenseur vient de `resolveOpposed(jetDéfenseur, aT figé)`
      // (l'attaquant garde son jet — calque `recover`/`disengage`), PAS de `roll ≤ target`. Le défenseur
      // RÉSISTE si l'attaquant ne l'emporte PAS (défenseur OU égalité). Simple sinon (réussite ≤ cible).
      if (opp) return { result: opposedCascadeRoll(t, opp.aT, st.target, opp.bonusSL ?? 0) };
      return { result: { roll: t.roll, target: st.target, sl: t.sl, success: t.success } };
    },
    outcome: (st) => testOutcome(st.result),
    // Résilience GLOBALE + Résistance (Menace) sur les étapes taguées `menace` (Contraction/Corruption/
    // Venin) ; `picker` (dé choisi) UNIQUEMENT sur une Peur de COMBAT (Test ÉTENDU, le DR
    // gagné dépend du dé, LDB 21 l.27) — pas sur une étape BINAIRE (Terreur/cible/Test de scène/nuit/opposé).
    caps: {
      forced: true,
      resist: true,
      picker: (st) => {
        const cp = st.combatPsych;
        const isExtendedPeur = !!cp && psychResolution(cp.kind).mode === 'extended';
        return st.forced && isExtendedPeur && st.target != null && st.result
          ? { roll: st.result.roll, target: st.target, critable: false }
          : null;
      },
      // Détermination (LDB 17 l.62) sur une étape de PSYCHOLOGIE (combat/rencontre) : immunité TEMPORAIRE,
      // PAS une réussite forcée. Dépense 1 point de Détermination (`spendResolveForPsychImmunity` →
      // psychImmuneRoundsLeft) et MARQUE l'étape `immune` ; l'applier psy lit ce flag pour NE PAS cumuler
      // le DR (Peur) ni poser le Brisé (Terreur) — la source est IGNORÉE ce Round, pas vaincue, et reprend
      // à l'expiration. Le `result` synthétique (DR 0) ne sert qu'à faire avancer la cascade : c'est
      // `step.immune` (pas le succès) qui gouverne la conséquence côté applier. Réservé aux étapes psy.
      determine: (slot, actor, get, _set, commit) => {
        if (slot.result || slot.target == null) return; // jamais sur une étape déjà résolue / sans jet
        if (!slot.combatPsych && !slot.encounterPsych) return; // Détermination = immunité PSYCHOLOGIQUE seulement
        if ((actor.resolve ?? 0) <= 0) return;
        const msg = spendResolveForPsychImmunity(actor); // dépense + psychImmuneRoundsLeft (ActiveEffect 2 Rounds)
        if (!msg) return;
        // Marqueur NEUTRE (DR 0, aucun dé forcé) pour avancer la cascade ; `commit(..,{touch})` rafraîchit
        // les combattants (combat ⇄ groupe), comme tous les autres verbes de ce flux.
        commit({ immune: true, result: { roll: slot.target, target: slot.target, sl: 0, success: true } }, { touch: true });
        get().log(msg);
      },
    },
    bonus: {
      derive: (_s, st) => {
        if (!st.result) return null;
        const opp = st.meta?.opposed;
        // Chance « +1 DR » (LDB 17 l.26) sur un Test OPPOSÉ : on RE-OPPOSE le jet défenseur amélioré (+1 DR)
        // à l'attaquant FIGÉ (1ʳᵉ position) — le +1 peut FAIRE BASCULER l'issue (calque `disengage.bonus.derive`).
        // `bonusSL` (Piège-lame, LDB 62 l.295) s'AJOUTE en plus au DR du défenseur dans l'opposition (pas au
        // `sl` reporté, qui reste le DR propre +1).
        if (opp) {
          const def2 = bumpSL(hydrateTR({ roll: st.result.roll, target: st.target!, success: st.result.success, sl: st.result.sl }));
          const o = resolveOpposed(opp.aT, bumpSL(def2, opp.bonusSL ?? 0));
          return { result: { roll: def2.roll, target: st.target!, sl: def2.sl, success: o.winner !== 'attacker' } };
        }
        return bumpResultSL(st);
      },
    },
  }),

  /**
   * Enfoncer une porte À PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE (même
   * fabrique que le Contre-sort, métier = DÉGÂTS sur objet) : chaque héros frappe indépendamment
   * (Test de Corps à corps (Bagarre)), dégâts = max(0, DR + Bonus de Force − BE) ; objets : PAS de
   * minimum 1 (l.92). Le cumul des dégâts vs B vit dans `forceDoorConfirm` (store).
   */
  forceDoor: makeRollFlow<PendingForceDoor, ForceDoorParticipant>({
    key: 'pendingForceDoor',
    multi: { slots: (p) => p.participants, idOf: (r) => r.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (r) => !!r.result,
    actor: (s, r) => actorIn(s, r.id),
    resolve: (_s, _r, actor, _get, forced, p) => {
      if (!actor || !p) return null;
      const value = testValue(actor, 'corps-a-corps'); // Bagarre (CC + avances)
      const bf = bonus(effectiveChar(actor, 'force'));
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : DR maximal (dé MEILLEUR) → dégâts max (LDB 17 l.73).
        const die = bestForcedRoll(value);
        const sl = evaluateTest(die, value).sl;
        return { result: { roll: die, target: value, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      }
      const t = rollTest(value, 'intermediaire', battleRng());
      return { result: { roll: t.roll, target: t.target, sl: t.sl, damage: Math.max(0, t.sl + bf - p.doorBE) } };
    },
    outcome: (r) => cleanRollOutcome(r.result), // d100 propre réussi (roll ≤ cible)
    caps: { forced: true },
    bonus: {
      // Chance « +1 DR » : +1 au DR → +1 dégât (avant réduction par le BE).
      derive: (_s, r, actor, p) => {
        if (!r.result || !p) return null;
        const bf = bonus(effectiveChar(actor, 'force'));
        const sl = r.result.sl + 1;
        return { result: { ...r.result, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      },
    },
  }),

  /**
   * Désengagement — Test opposé d'Esquive (LDB 15 l.43-68). Le JET INITIAL reste métier
   * (`disengageRoll` : transition de phase choice → esquive) ; le jet du foe (`p.atk`) reste figé.
   * Issue BINAIRE (success/tie/fail) → pas de choix du dé.
   */
  disengage: opposedBinaryFlow<PendingDisengage>({
    key: 'pendingDisengage',
    rolled: (p) => !!p.result,
    actorId: (p) => p.moverId,
    rollActor: (actor) => rollMeleeDefender(actor, 'esquive', battleRng()), // Esquive du mover (= « attaquant »)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk, // jet du foe FIGÉ (LDB 15 l.43-68)
  }),

  /**
   * « Au Contact » — Test opposé de Corps à corps (LDB 62 l.176, Option « Longueur d'arme »). CALQUE
   * EXACT du Désengagement : le jet INITIAL du mover reste métier (`auContactRoll`) ; le jet du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Corps à corps du mover se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter.
   */
  auContact: opposedBinaryFlow<PendingAuContact>({
    key: 'pendingAuContact',
    rolled: (p) => !!p.result,
    actorId: (p) => p.moverId,
    rollActor: (actor) => rollDisengageAttack(actor, battleRng()), // Corps à corps du mover (LDB 62 l.176)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk,
  }),

  /**
   * Empoignade — Test opposé de FORCE (LDB 14 l.161). CALQUE EXACT d'Au Contact : le jet de Force du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Force de l'acteur (`p.def`) se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter (Dégâts/Empêtré).
   */
  grapple: opposedBinaryFlow<PendingGrapple>({
    key: 'pendingGrapple',
    rolled: (p) => !!p.result,
    actorId: (p) => p.actorId,
    rollActor: (actor) => rollGrappleForce(actor, battleRng()), // Force de l'acteur (LDB 14 l.161)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk,
  }),

  /** « Fuir » — Test de Calme du fuyard après le coup dans le dos qui touche (LDB 15 l.66) :
   *  échec → État Brisé (1 + DR négatif). Test SEC de Calme Intermédiaire (+0), INFLUENÇABLE comme
   *  `approach` (même patron) ; porté par `pendingDisengage.fuir.calme` (le coup dans le dos reste SUBI,
   *  montré INLINE). `fleeConfirm` applique le Brisé et complète la fuite (libération + Course). */
  flee: makeRollFlow<PendingDisengage>({
    key: 'pendingDisengage',
    rolled: (p) => !!p.fuir?.calme,
    actor: (s, p) => actorIn(s, p.moverId),
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      if (!actor || !p.fuir) return null;
      // RAW LDB 17 l.73 : avant le jet (calme==null → choisit 01) OU après un échec.
      if (forced) { const f = forcedBinarySuccess(p.fuir.calme); return f ? { fuir: { ...p.fuir, calme: f } } : null; }
      // Même cœur de jet que les autres Tests simples (`simpleRoll`) — seul l'ENDROIT de rangement diffère (`fuir.calme`).
      const calme = simpleRoll(p, actor, (_p, a) => calmeValue(a), 'intermediaire', battleRng);
      return calme ? { fuir: { ...p.fuir, calme } } : null;
    },
    outcome: (p) => testOutcome(p.fuir?.calme),
    bonus: {
      // Chance « +1 DR » (LDB 17 l.26) — calque `heal` : +1 au DR, la réussite (d100 propre) NE change PAS.
      // Utile ici car le nombre d'États Brisés décroît avec le DR (`broken = 1 + max(0,-sl)`, plancher 1
      // sur un échec) ; passer un échec en réussite (Brisé 0) reste réservé à la relance/Résilience.
      guard: (p) => !!p.fuir?.calme,
      derive: (_s, p) => ({ fuir: { ...p.fuir!, calme: { ...p.fuir!.calme!, sl: p.fuir!.calme!.sl + 1 } } }),
    },
  }),

  /** Piétinement (LDB 85 l.320-321) : attaque de Bagarre, action gratuite à 1 Avantage. */
  trample: makeRollFlow<PendingTrample>({
    key: 'pendingTrample',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: {
      forced: true,
      picker: (p) => (p.forced && p.result?.attackerDetail ? { roll: p.result.attackerDetail.roll, target: p.result.attackerDetail.target } : null),
    },
    resolve: (s, p, actor, _get, forced) => {
      const target = actorIn(s, p.targetId);
      if (!actor || !target) return null;
      if (forced) {
        const ad = p.result?.attackerDetail;
        if (!ad) return null; // (ancien `force.guard`)
        if (forced.roll != null) {
          // « vous choisissez le résultat » (LDB 17 l.73) : un Piétinement est une attaque — un
          // double choisi (11) inflige un Coup Critique, comme l'exemple Salundra (l.75). Doit RESTER réussi.
          if (forced.roll > maxForcedRoll(ad.target)) return null;
          const atk2 = forcedTR(forced.roll, ad.target, Math.max(evaluateTest(forced.roll, ad.target).sl, 1));
          return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
        }
        const atk2 = forcedTR(ad.roll, ad.target, Math.max(ad.sl, 1));
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      }
      return { result: resolveTrample(actor, target, battleRng()) };
    },
    outcome: (p) => testOutcome(p.result?.attackerDetail),
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2 = bumpSL(hydrateTR(ad));
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      },
    },
  }),

  /**
   * Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé. CALQUE de
   * `trample` (jet MONO d'attaquant influençable) — la seule différence est l'issue métier
   * (`resolveBattement` dans `battementConfirm`, pas une attaque à Dégâts). Le jet de CC est figé ici ;
   * `caps.forced` autorise la Résilience (dé PAR DÉFAUT = DR max → retire le plus d'Avantage). PAS de
   * `picker` : l'Avantage retiré ne dépend que du DR (`battementRemoval`), aucun Coup Critique ni
   * localisation ne rend un dé PRÉCIS meilleur que le DR max — le choix du dé n'apporterait rien (≠ trample).
   */
  battement: makeRollFlow<PendingBattement>({
    key: 'pendingBattement',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (_s, _p, actor) => {
      if (!actor) return null;
      return { result: rollManeuverAttacker(actor, 'capacite-de-combat', battleRng()) };
    },
    outcome: (p) => testOutcome(p.result),
    // Test de CC NON opposé. Résilience (dé PAR DÉFAUT = DR max, l.103) + Chance « +1 DR » par `bumpSL`
    // (success intact — le vieux `bonus` forçait `success:true` : bug, LDB 17 l.84) via la lentille.
    lens: {
      actorTR: (p) => p.result ?? null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: tr }),
      dieTarget: (p, actor) => p.result?.target ?? combatValue(actor, 'melee'),
    },
  }),

  /**
   * Distraire (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme (foe).
   * CALQUE EXACT du Désengagement/Au Contact : le jet de Calme du foe (`p.defRoll`) reste FIGÉ ; seul le
   * jet d'Athlétisme du mover (`p.atk`) se (re)joue. Issue BINAIRE (success/tie/fail) → la Résilience fait
   * simplement l'emporter. L'issue métier (`resolveDistraire` → `distractedRounds`) vit dans `distraireConfirm`.
   */
  distraire: opposedBinaryFlow<PendingDistraire>({
    key: 'pendingDistraire',
    actorId: (p) => p.moverId,
    rollActor: (actor) => rollTest(distraireAttackValue(actor), 'intermediaire', battleRng()), // Athlétisme du mover (LDB 10 l.364)
    actorTR: (p) => p.atk, putActorTR: (tr) => ({ atk: tr }), // mover = « attaquant » : son jet = `p.atk`
    foeTR: (p) => p.defRoll, // Calme du foe FIGÉ
  }),

  /** Manœuvre de créature (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) qu'un héros active. Le jet
   *  INFLUENÇABLE est celui de l'ATTAQUANT (CC/CT) ; l'APPLICATION (jets des défenseurs + opposition)
   *  vit dans `maneuverConfirm`/`applyMan<X>`, pas ici. Un seul effort de souffle → un jet d'attaquant
   *  (LDB 85 l.251/376, relu influençable). Vomi : +40 d'attaquant (l.376) baked dans le jet. PAS de
   *  `picker` : le jet d'attaquant ne nourrit que le DR de l'OPPOSITION (`resolveManeuver` → `resolveOpposed`
   *  → marge), aucun Coup Critique ni localisation ne dépend du dé PRÉCIS (≠ attaque/trample) → un dé
   *  choisi n'apporte rien de plus que le DR max de la Résilience par défaut. */
  maneuver: makeRollFlow<PendingManeuver>({
    key: 'pendingManeuver',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (_s, p, actor) => {
      if (!actor) return null;
      const stat = creatureAttacks(actor.traits ?? []).find((a) => a.kind === p.kind)?.stat ?? 'capacite-de-tir';
      return { result: rollManeuverAttacker(actor, stat, battleRng(), maneuverAttackerDifficulty(p.kind)) };
    },
    outcome: (p) => testOutcome(p.result),
    // Test de CC/CT NON opposé (le dé ne nourrit que le DR d'OPPOSITION, aucun Critique). Résilience (dé PAR
    // DÉFAUT = DR max, l.73) + Chance « +1 DR » par `bumpSL` (success intact — LDB 17 l.84) via la lentille —
    // CALQUE `battement`. La cible du dé forcé = combatValue(stat) + Difficulté de la manœuvre (pré-jet correct).
    lens: {
      actorTR: (p) => p.result ?? null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: tr }),
      dieTarget: (p, actor) => {
        if (p.result?.target != null) return p.result.target;
        const stat = creatureAttacks(actor.traits ?? []).find((a) => a.kind === p.kind)?.stat ?? 'capacite-de-tir';
        return combatValue(actor, stat === 'capacite-de-combat' ? 'melee' : 'ranged') + DIFFICULTY_MODIFIERS[maneuverAttackerDifficulty(p.kind)];
      },
    },
  }),

  /** Course (LDB 15 l.79-82) : Athlétisme (+20) — à cheval, Chevaucher + Mouvement de la monture (LDB 14 l.215). */
  run: makeRollFlow<PendingRun>({
    key: 'pendingRun',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!s.battle || !actor) return null;
      if (forced) {
        if (p.result?.success) return null; // (ancien `force.guard : !p.result?.success`)
        const m = mountMovement(s.battle, actor); // à cheval : Mouvement de la monture (LDB 14 l.215)
        const base = p.result;
        // RAW LDB 17 l.73 : avant le jet (result==null → on choisit 01) OU après un échec.
        return { result: { success: true, roll: base?.roll ?? 1, target: base?.target, dr: Math.max(0, base?.dr ?? 0), bonusCases: Math.max(base?.bonusCases ?? 0, 2 * m) } };
      }
      // Sprinter (LDB 10) : « Votre Attribut de Mouvement compte comme plus élevé de 1 lorsque vous Courez. »
      return { result: resolveRun(testValue(actor, actor.mountId ? 'chevaucher' : 'athletisme'), mountMovement(s.battle, actor) + runMovementBonus(actor), battleRng()) };
    },
    outcome: (p) => sealOutcome(!!p.result?.success, p.result?.dr ?? 0, p.result?.roll ?? 0, p.result?.target ?? 0),
    // Chance « +1 DR » (LDB 17 l.26) s'applique à TOUT Test : sur une Course, +1 DR ALLONGE la distance.
    // Le porteur du DR est `dr`/`bonusCases` (PAS `sl`) → dérive BESPOKE (pas lentillée). Le DR de Course est
    // en MÈTRES (LDB 15 l.82), converti en cases comme `resolveRun` (÷2 arrondi, la CONSTANTE réelle — pas +2) :
    // +1 DR = +[round((dr+1)/2) − round(dr/2)] case(s). NE force PAS `success` (un +1 DR ne change pas un échec
    // en réussite, LDB 17 l.84).
    bonus: {
      guard: (p) => !!p.result, // pas de +DR avant le jet
      derive: (_s, p) => {
        if (!p.result) return null;
        const dr = p.result.dr + 1;
        const bonusCases = p.result.bonusCases + Math.round(dr / 2) - Math.round(p.result.dr / 2);
        return { result: { ...p.result, dr, bonusCases } };
      },
    },
  }),

  /** Manœuvre navale = TEST D'ÉQUIPAGE (MDG ch.14) : chaque rôle tenu lance SON Test (multi-jets). PJ = interactif
   *  (Chance/+1 DR/Pacte/Résilience sur SON jet) ; marin PNJ = témoin (auto-roulé à l'ouverture). La SOMME des DR
   *  (essentiel ×2) + Moral nourrit la Progression — calculée à la confirmation (`shipManeuverConfirm`). Forced
   *  (Résilience) = DR max du contributeur. Patron `forceDoor`. */
  shipManeuver: makeRollFlow<PendingShipManeuver, ShipManeuverParticipant>(crewRoleFlowSpec('pendingShipManeuver')),

  /** TIR DE BATTERIE = Test d'équipage des Artilleurs (MDG ch.14 l.128) — JUMEAU de `shipManeuver` (mêmes
   *  `rollCrewRole`/`forceCrewRole`) ; le total (`maneuverCrewTotal`) = DR PARTAGÉ de la volée, appliqué par
   *  `shipBatteryConfirm`. Forced (Résilience) = DR max du contributeur. */
  battery: makeRollFlow<PendingShipBattery, ShipBatteryParticipant>(crewRoleFlowSpec('pendingShipBattery')),

  /** TEST D'ÉQUIPAGE GÉNÉRIQUE (MDG ch.14, « Types de Test d'équipage ») — 3ᵉ consommateur de la MÊME spec
   *  de jet par rôle ; l'issue par type (Rude épreuve → Moral, l.110) vit dans `crewTestConfirm`. */
  crewTest: makeRollFlow<PendingCrewTest, ShipManeuverParticipant>(crewRoleFlowSpec('pendingCrewTest')),

  /** Étape-PARTICIPANTS d'une CASCADE (batch multi, seam de jet #275 Décision 4 cran 1) : UNE rangée par
   *  contributeur GÉNÉRIQUE de l'étape COURANTE (`pendingCascade.participants[cursor].participants`,
   *  `BatchParticipant`) — chaque participant lance un Test « +0 » sur sa cible EFFECTIVE bakée à la
   *  construction (`rollBatchParticipant` / `forceBatchParticipant` pour la Résilience). AUCUN concept de
   *  domaine : le flux ne connaît ni rôle ni navire, seule la LOCALISATION des slots diverge (au cursor,
   *  pas au top-level du pending). L'AGRÉGAT (`step.aggregate`) est calculé par `cascade.commitStep` à la
   *  validation de l'étape — ce flux ne fait QUE le jet individuel. */
  cascadeBatch: makeRollFlow<PendingCascade, BatchParticipant>({
    key: 'pendingCascade',
    multi: {
      slots: (p) => p.participants[p.cursor]?.participants ?? [],
      idOf: (r) => r.id,
      replace: (p, parts) => ({
        ...p,
        participants: p.participants.map((st, i) => (i === p.cursor ? { ...st, participants: parts } : st)),
      }),
    },
    rolled: (r) => !!r.result,
    actor: (s, r) => actorIn(s, r.id),
    caps: { forced: true },
    resolve: (_s, r, actor, _get, forced) => {
      if (!actor) return null; // rangée sans acteur résoluble (parité historique) — pas de jet
      return { result: forced ? forceBatchParticipant(r) : rollBatchParticipant(r, battleRng()) };
    },
    outcome: (r) => cleanRollOutcome(r.result),
    bonus: { derive: (_s, r) => bumpResultSL(r) },
  }),

  /** CHANSON DE MARIN (Talent, MDG 09 l.32-40) : Test de **Divertissement (Chant)** du chanteur — la
   *  chanson doit être CHOISIE au pré-jet (OptionChooser). Réussi → effet 3 min + DR sur l'équipage
   *  (`shantyConfirm`). Résilience : 01 → DR max (durée maximale). */
  shanty: makeRollFlow<PendingShanty>({
    key: 'pendingShanty',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.singerId),
    caps: { forced: true },
    resolve: (s, p, actor) => p.shantyId // chanson non choisie → pas de jet
      ? simpleTestResultResolve((_p, a) => testValue(a, 'divertissement', undefined, 'chant'), 'intermediaire')(s, p, actor)
      : null,
    outcome: (p) => testOutcome(p.result),
    // Chance/Résilience GLOBALES via la lentille `result` (LDB 17) : +1 DR = +1 min de chant (MDG 09 l.38, durée ∝ DR).
    lens: resultRollLens((_p, actor) => testValue(actor, 'divertissement', undefined, 'chant')),
  }),

  /** Focalisation (Test étendu de magie) — vaut en combat ET hors combat (`actorIn`). */
  focus: makeRollFlow<PendingFocus>({
    key: 'pendingFocus',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      if (forced) {
        const base = p.result;
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double, le choix
        // rationnel = LE MEILLEUR dé (`bestForcedRoll`, policy-aware) → DR MAXIMUM quand la cible du
        // Test est connue (post-échec) ; pré-jet (résultat synthétique sans cible), plancher DR 1 comme avant.
        const die = base?.target != null ? bestForcedRoll(base.target) : 1;
        const sl = base?.target != null ? Math.max(evaluateTest(die, base.target).sl, 1) : Math.max(base?.sl ?? 1, 1);
        return { result: { dr: Math.max(base?.dr ?? 0, sl), isCritical: base?.isCritical ?? false, isFumble: false, roll: die, target: base?.target, sl, log: `${actor.name} force la focalisation (Résilience).` } };
      }
      const spell = findSpellById(p.spellId);
      if (!spell) return null;
      return { result: resolveFocus(actor, spell, battleRng(), 'intermediaire', seaMagicContext(s).atSea) };
    },
    outcome: (p) => sealOutcome((p.result?.dr ?? -1) > 0, p.result?.dr ?? 0, p.result?.roll ?? 0, p.result?.target ?? 0), // DR nul = raté (aucun DR gagné → rejouable)
    bonus: {
      derive: (_s, p) => ({ result: { ...p.result!, dr: p.result!.dr + 1, log: `${p.result!.log} (+1 DR)` } }),
    },
  }),

  /** Dissipation permanente (LDB 46 l.204-207) : un Round du Test étendu de Langue (Magick). `value` porte
   *  déjà le Soutien « même Domaine ». Le DR cumule sur `caster.dispel` au confirm. Calque `focus`. */
  dispel: makeRollFlow<PendingDispel>({
    key: 'pendingDispel',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    caps: { forced: true },
    resolve: simpleTestResultResolve((p) => p.value, 'intermediaire'),
    outcome: (p) => testOutcome(p.result), // Round réussi → pas de Chance ; le cumul gère le DR négatif
    // Chance « +1 DR » (`bumpSL`) + Résilience GLOBALES via la lentille `result` (LDB 17) ; cible = valeur de Langue (Magick).
    lens: resultRollLens((p) => p.value),
  }),

  // (Test de Psychologie héros (Peur/Terreur/Traits ciblés, LDB 21) : PLUS de flux `psych` dédié. C'est
  //  une CASCADE de Round — résolue par le `FLOWS.cascade` générique, applier 'combatPsych'. La Peur
  //  forcée (Résilience) prend le DR maximal du `forceSuccess` générique, comme la psy de rencontre.)

  /** Entrée en Frénésie (LDB 21 l.31-36) : Test de FM. */
  frenzy: makeRollFlow<PendingFrenzy>({
    key: 'pendingFrenzy',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!s.battle || !actor) return null;
      if (forced) return forcedBinaryResult(p.result); // Résilience (LDB 17 l.73)
      return { result: resolveFrenzyEntry(effectiveChar(actor, 'force-mentale'), battleRng()) };
    },
    outcome: (p) => testOutcome(p.result),
  }),

  /** Approche d'une source de Peur (LDB 21 l.29) : Test SEC de Calme Intermédiaire (+0) pour oser
   *  se rapprocher — distinct du Test étendu qui VAINC la Peur (flux `psych`). */
  approach: makeRollFlow<PendingApproach>({
    key: 'pendingApproach',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      if (forced) return forcedBinaryResult(p.result); // Résilience (LDB 17 l.73)
      return simpleTestResultResolve((_p, a) => calmeValue(a), 'intermediaire')(s, p, actor);
    },
    outcome: (p) => testOutcome(p.result),
  }),

  /** Bénédiction de Protection (LDB 41 l.105) : Test de Force Mentale Accessible (+20) qui DIFFÈRE la
   *  déclaration d'attaque d'un héros sur une cible bénie — succès → l'attaque est relancée ; échec →
   *  l'attaque n'a pas lieu (« choisir une cible ou une Action différente »). Frère du flux `approach`. */
  ward: makeRollFlow<PendingWard>({
    key: 'pendingWard',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : avant le jet (choisit 01) OU après un échec.
      if (forced) return forcedBinaryResult(p.result);
      return simpleTestResultResolve((_p, a) => effectiveChar(a, 'force-mentale'), 'accessible')(s, p, actor);
    },
    outcome: (p) => testOutcome(p.result),
  }),

  /** Activité (LDB 23 interlude / EDOC voyage / MDG mer / ADE II ch.8 BATAILLE) : Test de Compétence
   *  dont l'issue est appliquée par `confirmActivity`. Cas SIMPLE (la vaste majorité) = un jet vs une
   *  cible. Cas de BATAILLE : Test COMBINÉ (Infiltration/Repérage, l.75/102 — un jet vs DEUX compétences,
   *  LDB 12 l.229) ou Test OPPOSÉ de « Tenez votre position » (l.161, l'ennemi a un jet FIGÉ). Le cycle
   *  Chance/Pacte/Résilience vit ICI ; l'application (Puissance/héros) vit dans `confirmActivity`. */
  activity: makeRollFlow<PendingActivity>({
    key: 'pendingActivity',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68, `caps.forced` + verbe `forceSuccess`) ; Chance
    // « +1 DR » (success intact). Cas simple + combiné/opposé unifiés dans `resolve`/`bonus` (pas de lentille :
    // le combiné/opposé porte deux issues, hors du cadre mono-jet de la lentille).
    // PAS de `picker` (dé CHOISI) : un Test d'Activité/Scène n'a AUCUN Coup Critique (concept de COMBAT
    // seul). Le dé forcé PAR DÉFAUT (`bestForcedRoll`, DR MAX) donne déjà la MEILLEURE issue possible
    // (Succès Stupéfiant DR ≥ 6 → général à terre l.208/217) — choisir un autre dé n'apporterait rien.
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      // Cible EFFECTIVE d'un jet SIMPLE : compétence + Difficulté + Modificateur de SITUATION (Menace −20
      // l.219 / Planification l.75). Les openers de BATAILLE la pré-cuisent dans `p.target` (mod fondu) ; les
      // openers d'interlude ouvrent avec `target: 0` (rempli ici au 1ᵉʳ jet). On la (re)calcule pour NE JAMAIS
      // relâcher le mod : IDENTIQUE à `p.target` en bataille, renseignée en interlude.
      const effTarget = Math.max(1, Math.min(99, p.skillValue + DIFFICULTY_MODIFIERS[p.difficulty] + (p.mod ?? 0)));
      if (forced) {
        if (activityWon(p)) return null; // rien à forcer si DÉJÀ gagnée (combiné full / tenue tenue / simple réussi)
        // Résilience « vous choisissez le résultat » (LDB 17 l.73) : LE MEILLEUR dé (`bestForcedRoll`,
        // policy-aware) → DR MAXIMUM. En Test COMBINÉ, le jet forcé doit réussir les DEUX cibles → dé ≤
        // min(cibles) (`bestForcedRoll(min)`) → niveau `full` ; en tenue, le PJ l'emporte sur l'opposition.
        if (p.target2 != null) {
          const die2 = bestForcedRoll(Math.min(p.target, p.target2));
          return { roll: die2, success: true, sl: Math.max(evaluateTest(die2, p.target).sl, 1), success2: true, sl2: Math.max(evaluateTest(die2, p.target2).sl, 1), combinedLevel: 'full' as const, forced: true };
        }
        const die = bestForcedRoll(effTarget);
        const primary = { roll: die, target: effTarget, success: true, sl: Math.max(evaluateTest(die, effTarget).sl, 1), forced: true };
        if (p.battle === 'round' && p.enemyValue != null) return { ...primary, enemySL: Math.min(-1, (p.enemySL ?? 0)) };
        return primary;
      }
      // Test COMBINÉ (Infiltration/Repérage, l.75/102) : UN jet confronté aux DEUX valeurs (LDB 12 l.229 ;
      // le mod de SITUATION est déjà fondu dans `p.target`/`p.target2` par l'opener de bataille).
      if (p.target2 != null) {
        const c = evaluateCombinedTest(d100(battleRng()), p.target, p.target2);
        return { roll: c.roll, sl: c.a.sl, success: c.a.success, sl2: c.b.sl, success2: c.b.success, combinedLevel: c.level };
      }
      // Test OPPOSÉ de « Tenez votre position » (l.161) : le PJ jette (`p.target` = mod fondu), l'ennemi a un
      // jet FIGÉ. Le DR net de l'ennemi (`enemySL`, positif = l'ennemi progresse) alimente le Point de rupture
      // à la résolution ; `success` = le PJ TIENT (son DR ≥ celui de l'ennemi ⟺ `enemySL ≤ 0`).
      if (p.battle === 'round' && p.enemyValue != null && p.enemyRoll != null) {
        const pt = evaluateTest(d100(battleRng()), p.target);
        const et = evaluateTest(p.enemyRoll, p.enemyValue);
        return { roll: pt.roll, sl: pt.sl, success: pt.sl >= et.sl, enemySL: et.sl - pt.sl };
      }
      // Simple : d100 vs la cible EFFECTIVE (mod inclus) — renseigne `p.target` (interlude) sans jamais
      // l'écraser par une cible SANS mod (fin du « Menace relâchée » des Scènes simples).
      const t = evaluateTest(d100(battleRng()), effTarget);
      return { roll: t.roll, target: effTarget, sl: t.sl, success: t.success };
    },
    // Issue CANONIQUE = `activityWon` (la MÊME source que la narration/l'Appliquer) : combiné `full`
    // seulement (un `partial` = ÉCHEC GLOBAL RAW), tenue tenue (opposition), ou simple réussi. Le gating
    // Chance/Pacte/Résilience en DÉRIVE — plus de prédicat `failed` séparé qui lisait skill-1 (bug corrigé).
    outcome: (p) => sealOutcome(activityWon(p), p.sl ?? 0, p.roll ?? 0, p.target ?? 0),
    bonus: {
      // Chance « +1 DR » (LDB 17 l.26/84 : un Degré de plus ne transforme JAMAIS un échec en réussite).
      derive: (_s, p) => {
        // Combiné : +1 DR sur la 1ʳᵉ cible ; les réussites (donc le NIVEAU) restent INTACTES — on ré-affiche
        // le niveau depuis les réussites figées (`p.success`/`p.success2`), jamais depuis un re-jet numérique.
        if (p.target2 != null) {
          const passed = (p.success ? 1 : 0) + (p.success2 ? 1 : 0);
          return { sl: p.sl + 1, combinedLevel: passed === 2 ? 'full' as const : passed === 1 ? 'partial' as const : 'fail' as const };
        }
        // Tenue (Test OPPOSÉ) : +1 DR au PJ réduit d'autant le DR net de l'ennemi ; l'issue se RE-DÉRIVE de la
        // marge (`success = enemySL ≤ 0`) — cohérente avec `enemySL` ET `applyHoldResolution` (massBattleFlow).
        if (p.battle === 'round' && p.enemyValue != null) {
          const enemySL = (p.enemySL ?? 0) - 1;
          return { sl: p.sl + 1, success: enemySL <= 0, enemySL };
        }
        // Simple : +1 DR, `success` INTACT (bumpSL ; LDB 17 l.84).
        return { sl: p.sl + 1 };
      },
    },
    touch: touchActors,
  }),

  /** Rechargement (LDB 63 l.28-29) : Test ÉTENDU de Projectiles — le DR se cumule à l'Appliquer. */
  reload: makeRollFlow<PendingReload>({
    key: 'pendingReload',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact). Calque `heal`.
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Test étendu de Projectiles (battleRng) ; valeur bakée → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Chance « +1 DR » (le Test étendu cumule le DR) + Résilience GLOBALE via la lentille plate ; le garde du
    // forceSuccess (déjà réussi → rien à forcer, LDB 17 l.73) vit dans `dieTarget` (→ null), pas dans `actorTR`.
    lens: flatRollLens((p) => p.success ? null : p.target),
  }),

  /** Main ensanglantée (AA 07 l.117) : Test de Dextérité Accessible (+20) PAR ACTION, AVANT d'ouvrir une
   *  attaque avec l'arme tenue dans la main gatée. Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via
   *  la lentille (`caps.forced` + verbe `forceSuccess`) ; Chance « +1 DR » par `bumpSL`. Calque `reload`.
   *  L'issue (RÉUSSITE → ouvre l'attaque ; ÉCHEC → `disarm` + Action consommée) vit dans `handGateConfirm`. */
  handGate: makeRollFlow<PendingHandGate>({
    key: 'pendingHandGate',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // valeur Dextérité BAKÉE → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.success ? null : p.target),
  }),

  /** « Se libérer » (Empêtré, Test opposé de Force) / « se rouler au sol » (En flammes, Athlétisme) — LDB 16. */
  recover: makeRollFlow<PendingStateRecovery>({
    key: 'pendingStateRecovery',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    // Test opposé de héros (Force/Athlétisme) → Résilience GLOBALE (LDB 17 l.68) : le résolveur forcé
    // fait L'EMPORTER l'acteur sur la source FIGÉE (`p.opponentRoll`), calque `disengage`/`bargain`.
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.success) return null; // déjà réussi → rien à forcer
        const target = p.roll?.target ?? p.skillValue + DIFFICULTY_MODIFIERS[p.difficulty]; // cible effective (cf. rollTest)
        const die = bestForcedRoll(target); // dé DR-MAX policy-aware (JAMAIS 01 en dur)
        const actorT = forcedTR(die, target, Math.max(evaluateTest(die, target).sl, p.requireSl ?? 1, 1));
        if (p.opposed && p.opponentRoll) {
          const opp = resolveOpposed(actorT, p.opponentRoll); // re-oppose vs la source FIGÉE
          return { roll: actorT, netSL: Math.max(1, opp.netSL), success: true }; // l'emporte (DR +1 mini)
        }
        return { roll: actorT, netSL: Math.max(p.requireSl ?? 1, 1), success: true };
      }
      const actorT = rollTest(p.skillValue, p.difficulty, battleRng());
      if (p.opposed && p.opponentValue != null) {
        const oppT = rollTest(p.opponentValue, 'intermediaire', battleRng());
        const opp = resolveOpposed(actorT, oppT);
        return { roll: actorT, opponentRoll: oppT, netSL: opp.netSL, success: opp.attackerWins };
      }
      const netSL = Math.max(0, actorT.sl);
      // Filets (Zoo Impérial p.29) : Test NON opposé, réussite exige DR ≥ Indice du filet (`requireSl`).
      return { roll: actorT, netSL, success: p.requireSl != null ? actorT.success && netSL >= p.requireSl : actorT.success };
    },
    reresolve: (_s, p) => {
      const actorT = rollTest(p.skillValue, p.difficulty, battleRng());
      if (p.opposed && p.opponentRoll) {
        const opp = resolveOpposed(actorT, p.opponentRoll); // la source garde son jet figé
        return { roll: actorT, netSL: opp.netSL, success: opp.attackerWins };
      }
      const netSL = Math.max(0, actorT.sl);
      return { roll: actorT, netSL, success: p.requireSl != null ? actorT.success && netSL >= p.requireSl : actorT.success };
    },
    outcome: (p) => sealOutcome(!!p.success, p.netSL ?? 0, p.roll?.roll ?? 0, p.roll?.target ?? 0),
    bonus: { derive: (_s, p) => ({ netSL: p.netSL + 1, success: p.requireSl != null ? (p.netSL + 1 >= p.requireSl) : p.success }) },
  }),

  /** Test de compétence interactif (Effet de scène `test`). `requireSL` = seuil de DR exigé. */
  test: makeRollFlow<PendingTest>({
    key: 'pendingTest',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      // +DR de Talent (LDB 10) sur un Test RÉUSSI — règle UNIVERSELLE `talentTestSLBonus` (matcher
      // STRUCTURÉ `test.matches`, par id). Le contexte `when` n'est pas
      // évalué ici (défaut conservateur ; cf. plan). PLUS les +DR d'effet actif/trait : par Compétence
      // (`skillDRBonus` — chanson « De toutes les terreurs » : +1 DR Calme, MDG 09 l.232) et par
      // Caractéristique (`charDRBonusOf` — « Camarades d'équipage » : +1 DR Sociabilité, l.236).
      const tDR = actor
        ? talentTestSLBonus(actor, { skill: p.skillId, char: p.char, spec: p.spec })
          + (p.skillId ? skillDRBonus(actor, p.skillId, p.spec) : 0)
          + charDRBonusOf(actor, p.char ?? (p.skillId ? effectiveSkillCharKey(actor, p.skillId, { spec: p.spec }) : undefined))
          + offTerrainTestDR(actor) // hors de son terrain : −DR à TOUS les Tests (Créature marine, MDG p.140)
        : 0;
      if (forced) {
        if (p.success) return null; // (ancien `force.guard : !p.success`) — rien à forcer si déjà réussi
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double sur un Test de
        // compétence, le choix rationnel = LE MEILLEUR dé (`bestForcedRoll`, policy-aware) → DR MAXIMUM
        // (les talents à bonus de DR s'ajoutent comme sur un jet naturel, le seuil `requireSL` reste garanti).
        const die = bestForcedRoll(p.target);
        return {
          roll: die, success: true,
          sl: Math.max(evaluateTest(die, p.target).sl + tDR, p.requireSL, 1),
          forced: true,
        };
      }
      let res = rollTest(p.skillValue, p.difficulty);
      // Talents d'INVERSION (LDB 10 — Sociable/Studieux/Lecture rapide/Pharmacologie/Chat de
      // gouttière/Noctambule/Pansement de fortune) : un Test raté est relu chiffres inversés s'il
      // devient réussi (Pansement plafonne à +1 DR).
      if (actor && !res.success) {
        const rev = talentReverseFailed(actor, { skill: p.skillId, spec: p.spec });
        if (rev) {
          const e = evaluateTest(reverseRoll(res.roll), res.target);
          if (e.success) res = { ...e, isDouble: res.isDouble, sl: rev.capDR != null ? Math.min(e.sl, rev.capDR) : e.sl };
        }
      }
      // Jeton d'inversion CONSOMMABLE « prochaine aventure » (LDB 23 l.209/218) : même mécanisme
      // (`reverseRoll`), consommé SEULEMENT si ça convertit l'échec en réussite (0 gaspillage).
      if (actor && !res.success) {
        const e = evaluateTest(reverseRoll(res.roll), res.target);
        if (e.success && consumeReverseToken(actor, { skill: p.skillId, spec: p.spec })) res = { ...e, isDouble: res.isDouble };
      }
      const sl = res.sl + (res.success ? tDR : 0);
      return { roll: res.roll, sl, isDouble: res.isDouble, success: res.success && sl >= p.requireSL };
    },
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl), // d100 propre réussi (LDB ch.12 l.56 + l.29-31)
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && p.sl + 1 >= p.requireSL }) },
  }),

  /** Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne
   *  au moteur teste l'Initiative sous peine d'être ébouillantée. Vrai Test JOUEUR → Résilience GLOBALE
   *  (LDB 17 l.68) via la lentille plate ; Chance « +1 DR » par `bumpSL`. L'ébouillantage (échec) est
   *  appliqué par `steamSaveConfirm`, qui reprend ensuite la boucle maritime. */
  steamSave: makeRollFlow<PendingSteamSave>({
    key: 'pendingSteamSave',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty),
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.success ? null : p.target), // rien à forcer si déjà réussi
  }),

  /** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance ou de Calme
   *  Intermédiaire (+0) ; le gain de Points dépend du niveau ET du DR (cf. corruptionGain) —
   *  la Chance « +1 DR » peut donc réduire le gain d'une exposition modérée/majeure. */
  corruption: makeRollFlow<PendingCorruption>({
    key: 'pendingCorruption',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    // Résistance (Menace) (LDB 10, `caps.resist`) : exposition → menace 'Corruption' ; seuil (échec =
    // mutation) → menace 'Mutation'. Pas de Résilience sur ce flux (inchangé : pas de `caps.forced`).
    caps: { resist: true },
    resolve: simpleTestResolve((p, actor) => testValue(actor, p.skill), 'intermediaire'),
    outcome: (p) => rollOutcome(p.roll, p.target ?? 0, p.sl),
    // Chance « +1 DR » (`bumpSL`, success intact) + Résistance (Menace) GLOBALES via la lentille : le
    // resist force l'auto-succès à DR = Bonus d'Endurance (LDB 10 l.1015-1021), cible = valeur du Test.
    lens: {
      actorTR: (p) => p.roll != null ? hydrateTR({ roll: p.roll, target: p.target ?? 0, success: !!p.success, sl: p.sl ?? 0 }) : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success }),
      dieTarget: (p, actor) => testValue(actor, p.skill),
    },
  }),

  /** Évaluation (LDB 59 l.41) : révèle la qualité cachée + estime le prix. */
  appraise: makeRollFlow<PendingAppraise>({
    key: 'pendingAppraise',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact).
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, () => defaultRNG, { actorless: true }), // Évaluation HORS combat → defaultRNG (le rng actuel) ; valeur bakée → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.target),
  }),

  /** Marchandage (LDB 59 l.43) : Test OPPOSÉ joueur vs marchand — le marchand garde son jet figé. */
  bargain: makeRollFlow<PendingBargain>({
    key: 'pendingBargain',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.playerId),
    touch: touchActors,
    // Test opposé de héros vs marchand FIGÉ → Résilience GLOBALE (LDB 17 l.68) : le résolveur forcé fait
    // L'EMPORTER le joueur sur le marchand figé (`p.merchantRoll`), calque `recover`/`disengage`.
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.result?.attackerWins) return null; // le joueur l'emporte déjà → rien à forcer
        if (p.merchantRoll == null) return null; // pas de jet marchand figé (avant le 1er Lancer) → rien à opposer
        const target = p.roll?.target ?? p.playerSkill + DIFFICULTY_MODIFIERS.intermediaire; // cible effective (cf. rollTest)
        const die = bestForcedRoll(target); // dé DR-MAX policy-aware (JAMAIS 01 en dur)
        const player = forcedTR(die, target, Math.max(evaluateTest(die, target).sl, 1));
        const result = resolveOpposed(player, p.merchantRoll); // re-oppose vs le marchand FIGÉ
        // Résilience = le joueur l'emporte d'au moins un Degré (LDB 17 l.68).
        return { roll: player, result: { ...result, winner: 'attacker' as const, attackerWins: true, netSL: Math.max(1, result.netSL) } };
      }
      const player = rollTest(p.playerSkill, 'intermediaire');
      const merchant = rollTest(p.merchantValue, 'intermediaire');
      return { roll: player, merchantRoll: merchant, result: resolveOpposed(player, merchant) };
    },
    reresolve: (_s, p) => {
      if (p.merchantRoll == null) return null;
      const player = rollTest(p.playerSkill, 'intermediaire');
      return { roll: player, result: resolveOpposed(player, p.merchantRoll) };
    },
    outcome: (p) => rollOutcome(p.roll?.roll, p.roll?.target ?? 0, p.roll?.sl),
    bonus: {
      derive: (_s, p) => {
        if (p.roll == null || p.merchantRoll == null) return null;
        const boosted = bumpSL(p.roll);
        return { roll: boosted, result: resolveOpposed(boosted, p.merchantRoll) };
      },
    },
  }),

  /** Soin de Guérison (LDB 09) — combat ⇄ hors combat (`actorIn`). La Chirurgie (Test étendu
   *  multi-passes) a son propre flux `surgery` ci-dessous (une passe = une modale influençable). */
  heal: makeRollFlow<PendingHeal>({
    key: 'pendingHeal',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.healerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Médecine bakée : le soigneur peut être un PNJ hors actorIn → actorless (jamais nul faute d'acteur live)
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Résilience GLOBALE via la lentille plate ; le garde du forceSuccess (déjà réussi OU mode chirurgie :
    // rien à forcer) vit dans `dieTarget` (→ null), pas dans `actorTR` (qui sert aussi le `bonusSL`).
    lens: flatRollLens((p) => (p.success || p.mode === 'surgery') ? null : p.target),
  }),

  /** Chirurgie — le Test de Médecine d'UNE passe (Test ÉTENDU, LDB 10 l.154 / 12 l.200). Calque
   *  `heal` : acteur = le chirurgien (héros → Chance/Pacte/Résilience ; PNJ → influence no-op). Ici
   *  `resolve` ne fait QUE le jet de la passe (DR = `sl`) ; le CUMUL du DR + 1d10 PB + Hémorragie +
   *  le Test d'infection vivent dans `surgeryNext` (medicFlow), comme `extendedTestNext`. */
  surgery: makeRollFlow<PendingSurgery>({
    key: 'pendingSurgery',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.healerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Médecine bakée : le soigneur peut être un PNJ hors actorIn → actorless (jamais nul faute d'acteur live)
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Résilience GLOBALE via la lentille plate ; le garde du forceSuccess (déjà réussi → rien à forcer)
    // vit dans `dieTarget` (→ null), pas dans `actorTR` (qui sert aussi le `bonusSL`).
    lens: flatRollLens((p) => p.success ? null : p.target),
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE du câblage des flux de jet différé.
//
// `FLOW_VERBS` porte, par flux (clé = PRÉFIXE des délégués `<prefix><Verbe>` du store), son type
// (mono/multi), le SOUS-ENSEMBLE de verbes exposés, et `coop` — MAIS PAS le handler. C'est délibéré :
// le handler `FLOWS.x` référence `Get`/`Set` → `GameState` → `RollFlowActionsMap`, donc l'inclure dans la
// source du TYPE créerait un CYCLE (`FLOWS` deviendrait `any`). `FLOW_VERBS` (sans handler) est donc la
// source du TYPE (`RollFlowActionsMap`, plus bas) ET des verbes runtime/intents ; `FLOW_HANDLERS` associe
// le handler pour le seul RUNTIME (`buildRollFlowActions`), avec exhaustivité garantie. Le préfixe est
// DÉCORRÉLÉ de la clé `FLOWS` (2 cas : shipBattery→FLOWS.battery, opposition→FLOWS.castOpposition).
// `coop:true` = verbes exposés comme intents invité (dérivés dans `net/intents.ts`, `resist` exclu).
// ─────────────────────────────────────────────────────────────────────────────

interface FlowVerbs {
  kind: 'mono' | 'multi';
  verbs: readonly RollVerb[];
  /** Verbes exposés comme intents coop invité (dérivés ; `resist` toujours exclu). Défaut : false. */
  coop?: boolean;
}

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll'], coop: true },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  cast:         { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  disengage:    { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  flee:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
  auContact:    { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  grapple:      { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  trample:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  battement:    { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  distraire:    { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  maneuver:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  run:          { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
  reload:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  handGate:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  recover:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  focus:        { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  dispel:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  frenzy:       { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'], coop: true },
  approach:     { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'] },
  ward:         { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'], coop: true },
  heal:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  surgery:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'resist'], coop: true },
  test:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'cancel'] },
  steamSave:    { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  activity:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  bargain:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  appraise:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  shanty:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'] },
  counterspell: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  cascade:      { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'determine'], coop: true },
  opposition:   { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'resist'] },
  extendedTest: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  forceDoor:    { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  shipManeuver: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
  shipBattery:  { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
  crewTest:     { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
  cascadeBatch: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'], coop: true },
} as const satisfies Record<string, FlowVerbs>;

/** Handler (runtime) par flux — préfixe → `FLOWS.x`. `satisfies Record<keyof typeof FLOW_VERBS, …>`
 *  force l'EXHAUSTIVITÉ : tout flux de `FLOW_VERBS` doit avoir son handler ici (sinon `tsc` casse).
 *  Décorrélé de la clé `FLOWS` (shipBattery→battery, opposition→castOpposition). */
const FLOW_HANDLERS = {
  attack: FLOWS.attack, defense: FLOWS.defense, cast: FLOWS.cast, disengage: FLOWS.disengage, flee: FLOWS.flee,
  auContact: FLOWS.auContact, grapple: FLOWS.grapple, trample: FLOWS.trample, battement: FLOWS.battement,
  distraire: FLOWS.distraire, maneuver: FLOWS.maneuver, run: FLOWS.run, reload: FLOWS.reload, handGate: FLOWS.handGate, recover: FLOWS.recover,
  focus: FLOWS.focus, dispel: FLOWS.dispel, frenzy: FLOWS.frenzy, approach: FLOWS.approach, ward: FLOWS.ward,
  heal: FLOWS.heal, surgery: FLOWS.surgery, corruption: FLOWS.corruption, test: FLOWS.test, steamSave: FLOWS.steamSave,
  activity: FLOWS.activity, bargain: FLOWS.bargain, appraise: FLOWS.appraise, shanty: FLOWS.shanty,
  counterspell: FLOWS.counterspell, cascade: FLOWS.cascade, opposition: FLOWS.castOpposition, extendedTest: FLOWS.extendedTest,
  forceDoor: FLOWS.forceDoor, shipManeuver: FLOWS.shipManeuver, shipBattery: FLOWS.battery, crewTest: FLOWS.crewTest,
  cascadeBatch: FLOWS.cascadeBatch,
} satisfies Record<keyof typeof FLOW_VERBS, RollFlowHandlers>;

/** Un flux → ses délégués (Mono ou Multi selon `kind`) ; verbes lus depuis `FLOW_VERBS`. */
type WiringActions<P extends string, W extends FlowVerbs> =
  W['kind'] extends 'multi'
    ? MultiRollActions<P, W['verbs'][number]>
    : MonoRollActions<P, W['verbs'][number]>;

/** Aplatit une union d'objets en leur intersection (`{a} | {b}` → `{a} & {b}`). */
type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Matérialise une intersection CALCULÉE en objet PLAT — sinon `interface GameState extends …` n'en
 *  voit pas les membres (une intersection issue de `UnionToIntersection` reste « lazy »). */
type FlattenActions<T> = { [K in keyof T]: T[K] };

/**
 * Surface EXACTE des délégués de jet du store (`<prefix><Verbe>`), DÉRIVÉE de `FLOW_VERBS` (sans le
 * handler → aucune réf à `GameState`, donc PAS de cycle) : une entrée par flux → l'intersection de tous
 * les `Mono/MultiRollActions`, aplatie. `GameState extends RollFlowActionsMap` (store.ts) rend l'invariant
 * BIDIRECTIONNEL : ajouter/retirer un flux ou un verbe dans `FLOW_VERBS` change ce type → le store doit
 * tout réimplémenter (via `buildRollFlowActions`), sinon `tsc` casse.
 */
export type RollFlowActionsMap = FlattenActions<UnionToIntersection<{
  [P in keyof typeof FLOW_VERBS]: WiringActions<P & string, (typeof FLOW_VERBS)[P]>
}[keyof typeof FLOW_VERBS]>>;

/** Assemble les ~113 délégués de jet du store (`<prefix><Verbe>`) depuis `FLOW_VERBS` + `FLOW_HANDLERS`
 *  — remplace les 40 spreads `rollFlowActions(Multi)` éparpillés dans le store. Neutre : les délégués ne
 *  dépendent que de `(get, set)`. */
export function buildRollFlowActions(get: Get, set: Set): RollFlowActionsMap {
  const out: Record<string, unknown> = {};
  for (const [prefix, w] of Object.entries(FLOW_VERBS)) {
    const flow = FLOW_HANDLERS[prefix as keyof typeof FLOW_HANDLERS];
    Object.assign(out, w.kind === 'multi'
      ? rollFlowActionsMulti(prefix, flow, get, set, w.verbs)
      : rollFlowActions(prefix, flow, get, set, w.verbs));
  }
  return out as RollFlowActionsMap;
}
