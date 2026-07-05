/**
 * Specs des flux de jet différé (cf. `rollFlow.ts` pour le cycle de vie générique).
 *
 * Chaque entrée de `FLOWS` déclare la partie MÉTIER d'un flux (comment résoudre le jet, quand il
 * est relançable, comment la Chance « +1 DR » et la Résilience re-dérivent le résultat) ; le store
 * câble les handlers générés sous les noms canoniques (`trampleRoll`, `trampleReroll`…) et garde
 * la main sur « Appliquer » (`xConfirm`) et « Annuler ».
 *
 * ⚠️ Fidélité : chaque `resolve`/`derive` reprend À L'IDENTIQUE le code historique du store
 * (références RAW en place). Ne rien y « simplifier » sans citer la source.
 */
import type {
  GameState,
  PendingTrample, PendingBattement, PendingDistraire, PendingManeuver, PendingRun, PendingShipManeuver, ShipManeuverParticipant, PendingShipBattery, ShipBatteryParticipant, PendingCrewTest, PendingShanty, PendingFocus, PendingDispel, PendingFrenzy, PendingApproach, PendingWard,
  PendingReload, PendingStateRecovery, PendingTest, PendingAppraise, PendingBargain, PendingHeal, PendingSurgery,
  PendingCorruption, PendingAttack, PendingDefense, PendingCast, PendingDisengage, PendingAuContact, PendingGrapple,
  PendingCounterspell, CounterParticipant, PendingExtendedTest, ExtendedTestRound,
  PendingForceDoor, ForceDoorParticipant,
  PendingCastOpposition, OppositionParticipant,
  PendingCascade, CascadeStep,
} from './store';
import type { PendingActivity } from './interludeFlow';
import type { PendingBattleTest } from './massBattleFlow';
import type { Combatant, Weapon } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { makeRollFlow, type RollFlowHandlers } from './rollFlowFactory';
import { battleRng } from './battleRng';
import { actorIn, touchActors } from './combatOrParty';
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
import { resolveTrample, rederivePassiveAttack, finishMelee, finishRanged, rollMeleeDefender, rollDisengageAttack, rollGrappleForce, combatValue, type AttackResult, type DefenseSub } from '../engine/combat';
import { reverseRoll } from '../engine/combat';
import { talentReverseFailed, runMovementBonus } from '../engine/combatFeatures/dispatch';
import { rollTest, resolveOpposed, bumpSL, isDoubleRoll, type TestResult, evaluateTest, evaluateCombinedTest, maxForcedRoll } from '../engine/tests';
import { d100 } from '../engine/dice';
import { resolveRun } from '../engine/movement';
import { rollCrewRole, forceCrewRole } from './shipManeuver';
import { testValue, effectiveSkillCharKey, skillBaseValue } from '../engine/skills';
import { skillDRBonus, charDRBonusOf, offTerrainTestDR } from '../engine/ops';
import { resolveFocus, resolveMagicMissile, resolveCasting, rederiveCastSL, castTestTalentDR, talentTestSLBonus, resolveCounterspell, counterspellOutcomeFrom, castTestOf, castingValue } from '../engine/magic';
import { discreetPrayerDifficulty } from '../engine/prayer';
import { rule } from '../engine/policy';
import { effectiveChar, bonus } from '../engine/characteristics';
import { resolveFrenzyEntry, calmeValue, psychResolution } from '../engine/psychology';
import { findSpellById, findSkillById } from '../data/index';

/** Re-dérive une attaque FIGÉE avec un jet d'attaquant modifié (Chance +1 DR / Résilience / dé
 *  choisi) : Test opposé si un défenseur a joué, attaque passive sinon — partagé attaque/force. */
function rederiveAttack(attacker: Combatant, target: Combatant, p: PendingAttack, atk2: TestResult, combatants?: Combatant[]): AttackResult {
  const weapon = firedWeapon(attacker, target, p.weaponUid, combatants); // arme + munition + sous-effectif du poste (le re-jet voit la MÊME arme que la résolution)
  const r = p.result!;
  if (r.defenderDetail) {
    const dd = r.defenderDetail;
    const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: isDoubleRoll(dd.roll) };
    // p.withhold (Retenir ses coups, AA) propagé : la re-dérivation Chance/Résilience garde le coup non létal.
    return finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), p.location ?? undefined, [], 0, undefined, undefined, p.withhold);
  }
  return rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', p.location ?? undefined, p.withhold);
}

/** Résout le résultat d'une défense réactive : TIR DÉFENDU (`finishRanged`, opposition RAW à distance —
 *  Protectrice 2+/Bout Portant/tireur Engagé) OU mêlée (`finishMelee`), selon le type d'arme FIGÉE de
 *  l'attaquant. `p.distanceTiles` sert au breakdown Projectiles ; `parry` = arme de parade choisie. */
function finishDefenseResult(attacker: Combatant, defender: Combatant, p: PendingDefense, def: TestResult, dodgeMod = 0, parry?: Weapon): AttackResult {
  const sub = defenseSubOf(defender, p);
  return p.weapon.type === 'ranged'
    ? finishRanged(attacker, defender, p.weapon, p.atk, def, p.mode, p.distanceTiles, p.location ?? undefined, [], parry, dodgeMod)
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
export type RollVerb = 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll' | 'resist' | 'cancel';

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
    resolve: (s, r, actor, _get, forced) => {
      if (!actor) return null;
      const rr = forced ? forceCrewRole(actor, r.roleId, r.cumul) : rollCrewRole(actor, r.roleId, battleRng(), r.cumul);
      return rr ? { result: rr } : null;
    },
    failed: (r) => !!r.result && r.result.roll > r.result.target, // d100 propre raté → Chance
    // Chance « +1 DR » sur CE contributeur (LDB 17 l.26).
    bonus: { derive: (s, r) => (r.result ? { result: { ...r.result, sl: r.result.sl + 1 } } : null) },
  };
}

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
          const atk2: TestResult = { roll: forced.roll, target: ad.target, success: true, sl, isDouble: isDoubleRoll(forced.roll) };
          return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
        }
        // Dé PAR DÉFAUT : on garde le jet courant, forcé à l'emporter.
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, defSL + 1, 1), isDouble: isDoubleRoll(ad.roll) };
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      }
      const r = resolveAttack(get, actor, target, p.location ?? undefined, p.fromCharge, p.intoCrowd, p.heldGround, p.weaponUid, p.withhold);
      return r ? { result: r.res, victimId: r.victim?.id } : null;
    },
    // 2ᵉ frappe du Maniement de deux armes : jet IMPOSÉ (d100 inversé) — ni relance ni Pacte.
    failed: (p) => !p.dualSecond && !!p.result && !p.result.attackerDetail?.success,
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      },
    },
    // « Annuler » (ex-`attackCancel`, migré verbatim) : défaire la charge misclic AVANT le jet
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
        const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
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
      if (forced) {
        const dd = p.result?.defenderDetail;
        if (!dd || !p.def) return null; // (ancien `force.guard`)
        if (forced.roll != null) {
          // Dé CHOISI — doit RESTER une réussite.
          if (forced.roll > maxForcedRoll(p.def.target)) return null;
          const sl = Math.max(evaluateTest(forced.roll, p.def.target).sl, p.atk.sl + 1, 1);
          const def2: TestResult = { roll: forced.roll, target: p.def.target, success: true, sl, isDouble: isDoubleRoll(forced.roll) };
          return { def: def2, result: finishDefenseResult(attacker, actor, p, def2) };
        }
        // Dé PAR DÉFAUT : Test opposé « vous l'emportez avec au moins DR +1 » (LDB 17 l.73).
        const def2: TestResult = { roll: dd.roll, target: dd.target, success: true, sl: Math.max(dd.sl, p.atk.sl + 1, 1), isDouble: isDoubleRoll(dd.roll) };
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2) };
      }
      // Neige −20 + cavalier −20 (LDB 14 l.115-116/225) ; Rapide : −10 à la parade d'une arme non-Rapide (LDB 62 l.320).
      const dodgeMod = (s.scene ? sceneCombatModifiers(s.scene, s.gameTime).dodgeMod : 0) + mountedDodgePenalty(actor);
      const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
      const def = rollMeleeDefender(actor, p.mode, battleRng(), dodgeMod, parry, p.weapon, defenseSubOf(actor, p));
      return { def, result: finishDefenseResult(attacker, actor, p, def, dodgeMod, parry) };
    },
    failed: (p) => !!p.result && !p.def?.success,
    bonus: {
      guard: (p) => !!p.result?.defenderDetail,
      derive: (s, p, actor) => {
        const attacker = actorIn(s, p.attackerId);
        if (!attacker) return null;
        const dd = p.result!.defenderDetail!;
        const def2: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl + 1, isDouble: isDoubleRoll(dd.roll) };
        const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, parry) };
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
            + castTestTalentDR(actor, castInfoIsPrayer(spell) ? 'priere' : 'langue', castInfoIsPrayer(spell) ? undefined : 'Magick');
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
        ? resolveMagicMissile(actor, target, spell, battleRng(), p.focused, ward)
        : resolveCasting(actor, spell, battleRng(), difficulty, p.focused, ward);
      return { result: res };
    },
    // Échec d'incantation = d100 propre raté (roll > cible) — relance/Pacte alignés.
    failed: (p) => !!p.result && p.result.roll > p.result.target,
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
        const value = castingValue(actor, 'langue', 'Magick');
        const roll = cur ? cur.counter.roll : 1; // 01 = jet propre garanti (LDB 17 l.73)
        const sl = Math.max(cur?.counter.sl ?? 1, castT.sl + 1, 1);
        const counterT: TestResult = { roll, target: value, success: true, sl, isDouble: isDoubleRoll(roll) };
        return { result: counterspellOutcomeFrom(actor, counterT, castT) };
      }
      return { result: resolveCounterspell(actor, castT, battleRng()) };
    },
    // Jet propre RATÉ (d100 du contre-lanceur > sa cible) → relançable par la Chance (LDB 12).
    failed: (part) => !!part.result && !part.result.counter.success,
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
        const oppose: TestResult = { roll: 1, target: oppVal, success: true, sl: forced.sl, isDouble: false };
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - forced.sl) } };
      }
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : la cible force sa réussite → résiste (l'emporte).
        const cur = part.result;
        const roll = cur ? cur.oppose.roll : 1; // 01 = jet propre garanti (LDB 17 l.73)
        const sl = Math.max(cur?.oppose.sl ?? 1, castT.sl + 1, 1);
        const oppose: TestResult = { roll, target: oppVal, success: true, sl, isDouble: isDoubleRoll(roll) };
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - sl) } };
      }
      const oppose = rollTest(oppVal, 'intermediaire', battleRng());
      const o = resolveOpposed(castT, oppose);
      return { result: { oppose, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - oppose.sl) } };
    },
    // La cible a ÉCHOUÉ à résister (le lanceur l'emporte) → relançable par SA Chance (héros défenseur).
    failed: (part) => !!part.result && !part.result.resisted,
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
    resolve: (s, _r, _actor, _get, forced, p) => {
      if (!p) return null;
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : Round garanti réussi (dé 01 → DR max), LDB 17 l.73.
        const e = evaluateTest(1, p.target);
        return { result: { roll: 1, sl: e.sl, success: true } };
      }
      // Cible déjà ajustée à la difficulté → Test « +0 » sur `p.target`.
      const t = rollTest(p.target, 'intermediaire', battleRng());
      return { result: { roll: t.roll, sl: t.sl, success: t.success } };
    },
    failed: (r) => !!r.result && !r.result.success,
    caps: { forced: true },
    bonus: {
      derive: (_s, r) => (r.result ? { result: { ...r.result, sl: r.result.sl + 1 } } : null),
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
        const die = forced.roll != null ? Math.min(Math.max(1, forced.roll), maxForcedRoll(st.target)) : 1;
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
    failed: (st) => !!st.result && !st.result.success,
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
          const def2: TestResult = { roll: st.result.roll, target: st.target!, success: st.result.success, sl: st.result.sl + 1, isDouble: isDoubleRoll(st.result.roll) };
          const o = resolveOpposed(opp.aT, bumpSL(def2, opp.bonusSL ?? 0));
          return { result: { roll: def2.roll, target: st.target!, sl: def2.sl, success: o.winner !== 'attacker' } };
        }
        return { result: { ...st.result, sl: st.result.sl + 1 } };
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
    resolve: (s, r, actor, _get, forced, p) => {
      if (!actor || !p) return null;
      const value = testValue(actor, 'corps-a-corps'); // Bagarre (CC + avances)
      const bf = bonus(effectiveChar(actor, 'F'));
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : DR maximal (dé 01) → dégâts max (LDB 17 l.73).
        const sl = evaluateTest(1, value).sl;
        return { result: { roll: 1, target: value, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      }
      const t = rollTest(value, 'intermediaire', battleRng());
      return { result: { roll: t.roll, target: t.target, sl: t.sl, damage: Math.max(0, t.sl + bf - p.doorBE) } };
    },
    failed: (r) => !!r.result && r.result.roll > r.result.target, // d100 propre raté → Chance
    caps: { forced: true },
    bonus: {
      // Chance « +1 DR » : +1 au DR → +1 dégât (avant réduction par le BE).
      derive: (s, r, actor, p) => {
        if (!r.result || !p) return null;
        const bf = bonus(effectiveChar(actor, 'F'));
        const sl = r.result.sl + 1;
        return { result: { ...r.result, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      },
    },
  }),

  /**
   * Désengagement — Test opposé d'Esquive (LDB 15-Dépl l.84-109). Le JET INITIAL reste métier
   * (`disengageRoll` : transition de phase choice → esquive) ; le jet du foe (`p.atk`) reste figé.
   * Issue BINAIRE (success/tie/fail) → pas de choix du dé.
   */
  disengage: makeRollFlow<PendingDisengage>({
    key: 'pendingDisengage',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.moverId),
    caps: { forced: true },
    resolve: (_s, p, actor) => {
      if (!actor || !p.atk) return null;
      const def = rollMeleeDefender(actor, 'esquive', battleRng());
      const opp = resolveOpposed(def, p.atk); // mover = « attaquant » du Test opposé
      return { def, result: disengageOutcome(opp.winner) };
    },
    failed: (p) => !p.def?.success,
    // Opposé BINAIRE via la lentille : Chance +1 DR re-oppose (`bumpSL`) ; Résilience « Je ne faillirai
    // pas ! » (LDB 17 l.68) = l'emporter (issue 'success', pas de dé à choisir). Foe figé = `p.atk`.
    lens: {
      actorTR: (p) => p.def ?? null,
      applyRoll: (_s, slot, _actor, _get, tr) => ({ def: tr, result: disengageOutcome(resolveOpposed(tr, slot.atk!).winner) }),
      forceWin: (slot, _actor, tr) => (slot.result && tr ? { result: 'success' as const } : null),
    },
  }),

  /**
   * « Au Contact » — Test opposé de Corps à corps (LDB 62 l.176, Option « Longueur d'arme »). CALQUE
   * EXACT du Désengagement : le jet INITIAL du mover reste métier (`auContactRoll`) ; le jet du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Corps à corps du mover se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter.
   */
  auContact: makeRollFlow<PendingAuContact>({
    key: 'pendingAuContact',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.moverId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor || !p.atk) return null;
      if (forced) {
        if (!p.result || !p.def) return null;
        return { result: 'success' as const }; // l'emporte (LDB ch.17 l.73)
      }
      const def = rollDisengageAttack(actor, battleRng()); // Corps à corps du mover (mover = « attaquant » du Test opposé)
      const opp = resolveOpposed(def, p.atk);
      return { def, result: disengageOutcome(opp.winner) };
    },
    failed: (p) => !p.def?.success,
    bonus: {
      guard: (p) => !!p.def,
      derive: (_s, p) => {
        const def2 = bumpSL(p.def!);
        const opp = resolveOpposed(def2, p.atk!);
        return { def: def2, result: disengageOutcome(opp.winner) };
      },
    },
  }),

  /**
   * Empoignade — Test opposé de FORCE (LDB 14 l.161). CALQUE EXACT d'Au Contact : le jet de Force du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Force de l'acteur (`p.def`) se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter (Dégâts/Empêtré).
   */
  grapple: makeRollFlow<PendingGrapple>({
    key: 'pendingGrapple',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.actorId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor || !p.atk) return null;
      if (forced) {
        if (!p.result || !p.def) return null;
        return { result: 'success' as const }; // l'emporte (LDB ch.17 l.73)
      }
      const def = rollGrappleForce(actor, battleRng()); // Force de l'acteur (= « attaquant » du Test opposé)
      const opp = resolveOpposed(def, p.atk);
      return { def, result: disengageOutcome(opp.winner) };
    },
    failed: (p) => !p.def?.success,
    bonus: {
      guard: (p) => !!p.def,
      derive: (_s, p) => {
        const def2 = bumpSL(p.def!);
        const opp = resolveOpposed(def2, p.atk!);
        return { def: def2, result: disengageOutcome(opp.winner) };
      },
    },
  }),

  /** « Fuir » — Test de Calme du fuyard après le coup dans le dos qui touche (LDB 15-Dépl l.105-107) :
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
      if (forced) return p.fuir.calme?.success ? null : { fuir: { ...p.fuir, calme: { success: true, roll: p.fuir.calme?.roll ?? 1, target: p.fuir.calme?.target, sl: Math.max(p.fuir.calme?.sl ?? 0, 0) } } };
      const t = rollTest(calmeValue(actor), 'intermediaire', battleRng());
      return { fuir: { ...p.fuir, calme: { success: t.success, roll: t.roll, target: t.target, sl: t.sl } } };
    },
    failed: (p) => !p.fuir?.calme?.success,
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
          const atk2: TestResult = { roll: forced.roll, target: ad.target, success: true, sl: Math.max(evaluateTest(forced.roll, ad.target).sl, 1), isDouble: isDoubleRoll(forced.roll) };
          return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
        }
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, 1), isDouble: isDoubleRoll(ad.roll) };
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      }
      return { result: resolveTrample(actor, target, battleRng()) };
    },
    failed: (p) => !p.result?.attackerDetail?.success,
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      },
    },
  }),

  /**
   * Battement (LDB 10 l.103 / AA l.4361) : Action, Test de Corps à corps NON opposé. CALQUE de
   * `trample` (jet MONO d'attaquant influençable) — la seule différence est l'issue métier
   * (`resolveBattement` dans `battementConfirm`, pas une attaque à Dégâts). Le jet de CC est figé ici ;
   * `caps.forced` + `picker` autorisent la Résilience (dé choisi : un 01 → DR max retire le plus d'Avantage).
   */
  battement: makeRollFlow<PendingBattement>({
    key: 'pendingBattement',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: {
      forced: true,
      picker: (p) => (p.forced && p.result ? { roll: p.result.roll, target: p.result.target } : null),
    },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      if (forced) {
        const cur = p.result;
        if (forced.roll != null) {
          // Dé CHOISI (LDB 17 l.73) : doit RESTER une réussite ; le DR gagné retire plus d'Avantage.
          if (cur && forced.roll > maxForcedRoll(cur.target)) return null;
          const target = cur?.target ?? combatValue(actor, 'melee');
          const e = evaluateTest(forced.roll, target);
          return { result: { roll: forced.roll, target, success: true, sl: Math.max(e.sl, 1), isDouble: isDoubleRoll(forced.roll) } };
        }
        // Dé PAR DÉFAUT (01 → DR max), avant le jet ou après un échec.
        if (cur?.success) return null;
        const target = cur?.target ?? combatValue(actor, 'melee');
        const e = evaluateTest(1, target);
        return { result: { roll: 1, target, success: true, sl: Math.max(e.sl, 1), isDouble: isDoubleRoll(1) } };
      }
      return { result: rollManeuverAttacker(actor, 'CC', battleRng()) };
    },
    failed: (p) => !!p.result && !p.result.success,
    bonus: {
      // Chance « +1 DR » (LDB 17 l.26) : un DR de plus → un Avantage adverse de plus retiré (l.103).
      guard: (p) => !!p.result,
      derive: (_s, p) => (p.result ? { result: { ...p.result, sl: p.result.sl + 1, success: true } } : null),
    },
  }),

  /**
   * Distraire (LDB 10 l.364 / AA l.4395) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme (foe).
   * CALQUE EXACT du Désengagement/Au Contact : le jet de Calme du foe (`p.defRoll`) reste FIGÉ ; seul le
   * jet d'Athlétisme du mover (`p.atk`) se (re)joue. Issue BINAIRE (success/tie/fail) → la Résilience fait
   * simplement l'emporter. L'issue métier (`resolveDistraire` → `distractedRounds`) vit dans `distraireConfirm`.
   */
  distraire: makeRollFlow<PendingDistraire>({
    key: 'pendingDistraire',
    rolled: (p) => !!p.atk,
    actor: (s, p) => actorIn(s, p.moverId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      if (forced) {
        if (!p.atk || !p.result) return null; // (calque `disengage` : rien à forcer avant/hors jet)
        return { result: 'success' as const }; // l'emporte (LDB ch.17 l.73)
      }
      const atk = rollTest(distraireAttackValue(actor), 'intermediaire', battleRng()); // mover = « attaquant » du Test opposé
      const opp = resolveOpposed(atk, p.defRoll);
      return { atk, result: disengageOutcome(opp.winner) };
    },
    failed: (p) => !!p.atk && !p.atk.success,
    bonus: {
      guard: (p) => !!p.atk,
      derive: (_s, p) => {
        const atk2 = bumpSL(p.atk!);
        const opp = resolveOpposed(atk2, p.defRoll);
        return { atk: atk2, result: disengageOutcome(opp.winner) };
      },
    },
  }),

  /** Manœuvre de créature (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) qu'un héros active. Le jet
   *  INFLUENÇABLE est celui de l'ATTAQUANT (CC/CT) ; l'APPLICATION (jets des défenseurs + opposition)
   *  vit dans `maneuverConfirm`/`applyMan<X>`, pas ici. Un seul effort de souffle → un jet d'attaquant
   *  (LDB 85 l.251/376, relu influençable). Vomi : +40 d'attaquant (l.376) baked dans le jet. */
  maneuver: makeRollFlow<PendingManeuver>({
    key: 'pendingManeuver',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      const stat = creatureAttacks(actor.traits ?? []).find((a) => a.kind === p.kind)?.stat ?? 'CT';
      if (forced) {
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double, DR MAX (01 → cible
        // connue post-jet) ou plancher DR 1 pré-jet. Mirroir de `focus`/`disengage` forcés.
        if (p.result?.success) return null;
        const base = p.result;
        const sl = base?.target != null ? Math.max(evaluateTest(1, base.target).sl, 1) : Math.max(base?.sl ?? 1, 1);
        return { result: { roll: 1, target: base?.target ?? 0, success: true, sl, isDouble: isDoubleRoll(1) } };
      }
      return { result: rollManeuverAttacker(actor, stat, battleRng(), maneuverAttackerDifficulty(p.kind)) };
    },
    failed: (p) => !!p.result && !p.result.success,
    bonus: {
      guard: (p) => !!p.result,
      derive: (_s, p) => (p.result ? { result: { ...p.result, sl: p.result.sl + 1, success: true } } : null),
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
    failed: (p) => !p.result?.success,
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

  /** CHANSON DE MARIN (Talent, MDG 09 l.32-40) : Test de **Divertissement (Chant)** du chanteur — la
   *  chanson doit être CHOISIE au pré-jet (OptionChooser). Réussi → effet 3 min + DR sur l'équipage
   *  (`shantyConfirm`). Résilience : 01 → DR max (durée maximale). */
  shanty: makeRollFlow<PendingShanty>({
    key: 'pendingShanty',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.singerId),
    caps: { forced: true },
    resolve: (s, p, actor) => {
      if (!actor || !p.shantyId) return null; // chanson non choisie → pas de jet
      const value = testValue(actor, 'divertissement', undefined, 'Chant'); // Intermédiaire (+0) → cible = valeur
      const t = rollTest(value, 'intermediaire', battleRng());
      return { result: { roll: t.roll, target: t.target, success: t.success, sl: t.sl } };
    },
    failed: (p) => !!p.result && !p.result.success,
    // Chance/Résilience GLOBALES via la lentille (LDB 17) : +1 DR = +1 min de chant (MDG 09 l.38, durée ∝ DR) ;
    // Résilience « Je ne faillirai pas ! » → dé 01 = durée MAX. Le +1 DR passe par `bumpSL` (success intact).
    lens: {
      actorTR: (p) => p.result ? { ...p.result, isDouble: isDoubleRoll(p.result.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: { roll: tr.roll, target: tr.target, success: tr.success, sl: tr.sl } }),
      dieTarget: (_slot, actor) => testValue(actor, 'divertissement', undefined, 'Chant'),
    },
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
        // rationnel est 01 → DR MAXIMUM quand la cible du Test est connue (post-échec) ;
        // pré-jet (résultat synthétique sans cible), plancher DR 1 comme avant.
        const sl = base?.target != null ? Math.max(evaluateTest(1, base.target).sl, 1) : Math.max(base?.sl ?? 1, 1);
        return { result: { dr: Math.max(base?.dr ?? 0, sl), isCritical: base?.isCritical ?? false, isFumble: false, roll: 1, target: base?.target, sl, log: `${actor.name} force la focalisation (Résilience).` } };
      }
      const spell = findSpellById(p.spellId);
      if (!spell) return null;
      return { result: resolveFocus(actor, spell, battleRng()) };
    },
    failed: (p) => p.result?.dr === 0, // aucun DR gagné → rejouable
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
    resolve: (_s, p, actor) => {
      if (!actor) return null;
      const r = rollTest(p.value, 'intermediaire', battleRng());
      return { result: { roll: r.roll, target: r.target, sl: r.sl, success: r.success } };
    },
    failed: (p) => !p.result?.success, // Round raté → rejouable (Chance) ; le cumul gère le DR négatif
    // Chance « +1 DR » (`bumpSL`, success intact) + Résilience GLOBALES via la lentille (LDB 17) : « Je ne
    // faillirai pas ! » → dé policy-aware (01 en standard = DR max du Round). Cible = valeur de Langue (Magick).
    lens: {
      actorTR: (p) => p.result ? { ...p.result, isDouble: isDoubleRoll(p.result.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: { roll: tr.roll, target: tr.target, success: tr.success, sl: tr.sl } }),
      dieTarget: (p) => p.value,
    },
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
      // RAW LDB 17 l.73 : avant le jet (result==null → choisit 01) OU après un échec.
      if (forced) return p.result?.success ? null : { result: { success: true, roll: p.result?.roll ?? 1, target: p.result?.target, sl: Math.max(p.result?.sl ?? 0, 0) } };
      return { result: resolveFrenzyEntry(effectiveChar(actor, 'FM'), battleRng()) };
    },
    failed: (p) => !p.result?.success,
  }),

  /** Approche d'une source de Peur (LDB 21 l.29) : Test SEC de Calme Intermédiaire (+0) pour oser
   *  se rapprocher — distinct du Test étendu qui VAINC la Peur (flux `psych`). */
  approach: makeRollFlow<PendingApproach>({
    key: 'pendingApproach',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      if (!actor) return null;
      // RAW LDB 17 l.73 : avant le jet (result==null → choisit 01) OU après un échec.
      if (forced) return p.result?.success ? null : { result: { success: true, roll: p.result?.roll ?? 1, target: p.result?.target, sl: Math.max(p.result?.sl ?? 0, 0) } };
      const t = rollTest(calmeValue(actor), 'intermediaire', battleRng());
      return { result: { success: t.success, roll: t.roll, target: t.target, sl: t.sl } };
    },
    failed: (p) => !p.result?.success,
  }),

  /** Bénédiction de Protection (LDB 41 l.105) : Test de Force Mentale Accessible (+20) qui DIFFÈRE la
   *  déclaration d'attaque d'un héros sur une cible bénie — succès → l'attaque est relancée ; échec →
   *  l'attaque n'a pas lieu (« choisir une cible ou une Action différente »). Frère du flux `approach`. */
  ward: makeRollFlow<PendingWard>({
    key: 'pendingWard',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      if (!actor) return null;
      // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : avant le jet (result==null → choisit 01)
      // OU après un échec — réussite garantie sans modifier un jet déjà réussi.
      if (forced) return p.result?.success ? null : { result: { success: true, roll: p.result?.roll ?? 1, target: p.result?.target, sl: Math.max(p.result?.sl ?? 0, 0) } };
      const t = rollTest(effectiveChar(actor, 'FM'), 'accessible', battleRng());
      return { result: { success: t.success, roll: t.roll, target: t.target, sl: t.sl } };
    },
    failed: (p) => !p.result?.success,
  }),

  /** Activité d'interlude (LDB 23) : Revenus (Test Accessible de la compétence de carrière,
   *  LDB 08 l.135) ou lancer d'Artisanat (Test ÉTENDU de Métier — le DR se cumule à l'Appliquer). */
  activity: makeRollFlow<PendingActivity>({
    key: 'pendingActivity',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact).
    caps: { forced: true },
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, target: res.target, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    lens: {
      actorTR: (p) => p.roll != null ? { roll: p.roll, target: p.target, success: p.success, sl: p.sl, isDouble: isDoubleRoll(p.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success }),
      dieTarget: (p) => p.target,
    },
    touch: touchActors,
  }),

  /** Rechargement (LDB 63 l.28-29) : Test ÉTENDU de Projectiles — le DR se cumule à l'Appliquer. */
  reload: makeRollFlow<PendingReload>({
    key: 'pendingReload',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, target: res.target, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1 }) },
  }),

  /** « Se libérer » (Empêtré, Test opposé de Force) / « se rouler au sol » (En flammes, Athlétisme) — LDB 16. */
  recover: makeRollFlow<PendingStateRecovery>({
    key: 'pendingStateRecovery',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    resolve: (_s, p) => {
      const actorT = rollTest(p.skillValue, p.difficulty, battleRng());
      if (p.opposed && p.opponentValue != null) {
        const oppT = rollTest(p.opponentValue, 'intermediaire', battleRng());
        const opp = resolveOpposed(actorT, oppT);
        return { roll: actorT, opponentRoll: oppT, netSL: opp.netSL, success: opp.attackerWins };
      }
      return { roll: actorT, netSL: Math.max(0, actorT.sl), success: actorT.success };
    },
    reresolve: (_s, p) => {
      const actorT = rollTest(p.skillValue, p.difficulty, battleRng());
      if (p.opposed && p.opponentRoll) {
        const opp = resolveOpposed(actorT, p.opponentRoll); // la source garde son jet figé
        return { roll: actorT, netSL: opp.netSL, success: opp.attackerWins };
      }
      return { roll: actorT, netSL: Math.max(0, actorT.sl), success: actorT.success };
    },
    failed: (p) => !p.success,
    bonus: { derive: (_s, p) => ({ netSL: p.netSL + 1 }) },
  }),

  /** Test de compétence interactif (Effet de scène `test`). `requireSL` = seuil de DR exigé. */
  test: makeRollFlow<PendingTest>({
    key: 'pendingTest',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      // +DR de Talent (LDB 10) sur un Test RÉUSSI — règle UNIVERSELLE `talentTestSLBonus` (matcher
      // STRUCTURÉ `test.matches`, par id ; subsume l'ex-`talentTestDR`). Le contexte `when` n'est pas
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
        // compétence, le choix rationnel est 01 → DR MAXIMUM (les talents à bonus de DR s'ajoutent
        // comme sur un jet naturel, le seuil `requireSL` reste garanti).
        return {
          roll: 1, success: true,
          sl: Math.max(evaluateTest(1, p.target).sl + tDR, p.requireSL, 1),
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
      const sl = res.sl + (res.success ? tDR : 0);
      return { roll: res.roll, sl, isDouble: res.isDouble, success: res.success && sl >= p.requireSL };
    },
    failed: (p) => (p.roll ?? 0) > p.target, // d100 propre raté (LDB ch.12 l.56 + l.29-31)
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && p.sl + 1 >= p.requireSL }) },
  }),

  /** Jet de PJ d'une bataille de masse (ADE II 08) : Discours inspirant (Commandement, l.71) ou Scène
   *  cinématique de Compétence (Motivation/Duel/Ligne de mire…, l.149-225). Même cycle Chance/Pacte/
   *  Résilience que le Test de scène ; l'application (delta de Puissance) vit dans `battleTestConfirm`. */
  battleTest: makeRollFlow<PendingBattleTest>({
    key: 'pendingBattleTest',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.success) return null; // rien à forcer si déjà réussi
        // Résilience « vous choisissez le résultat » (LDB 17 l.73) : 01 → DR MAXIMUM. En Test COMBINÉ, le
        // jet forcé 01 réussit les DEUX cibles → niveau `full` ; en tenue, le PJ l'emporte sur l'opposition.
        const primary = { roll: 1, success: true, sl: Math.max(evaluateTest(1, p.target).sl, 1), forced: true };
        if (p.target2 != null) return { ...primary, success2: true, sl2: Math.max(evaluateTest(1, p.target2).sl, 1), combinedLevel: 'full' as const };
        if (p.purpose === 'hold') return { ...primary, enemySL: Math.min(-1, (p.enemySL ?? 0)) };
        return primary;
      }
      // Test COMBINÉ (Infiltration/Repérage, l.75/102) : UN jet confronté aux DEUX valeurs (LDB 12 l.229).
      if (p.target2 != null) {
        const c = evaluateCombinedTest(d100(battleRng()), p.target, p.target2);
        return { roll: c.roll, sl: c.a.sl, success: c.a.success, sl2: c.b.sl, success2: c.b.success, combinedLevel: c.level };
      }
      // Test OPPOSÉ de « Tenez votre position » (l.161) : le PJ jette, l'ennemi a un jet FIGÉ. Le DR net
      // de l'ennemi (`enemySL`, positif = l'ennemi progresse) alimente le Point de rupture à la résolution.
      if (p.purpose === 'hold' && p.enemyValue != null && p.enemyRoll != null) {
        const pt = evaluateTest(d100(battleRng()), p.target);
        const et = evaluateTest(p.enemyRoll, p.enemyValue);
        return { roll: pt.roll, sl: pt.sl, success: pt.sl >= et.sl, enemySL: et.sl - pt.sl };
      }
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: {
      // Chance « +1 DR » : re-dérive le PRIMAIRE ; en Test combiné, ré-évalue le NIVEAU (+1 DR sur la 1ʳᵉ
      // cible peut faire basculer partial→full) ; en tenue, +1 DR au PJ réduit d'autant le DR net de l'ennemi.
      derive: (_s, p) => {
        const success = (p.roll ?? 0) <= p.target;
        if (p.target2 != null) {
          const passed = (success ? 1 : 0) + (p.success2 ? 1 : 0);
          return { sl: p.sl + 1, success, combinedLevel: passed === 2 ? 'full' as const : passed === 1 ? 'partial' as const : 'fail' as const };
        }
        if (p.purpose === 'hold') return { sl: p.sl + 1, success: p.sl + 1 >= 0 && success, enemySL: (p.enemySL ?? 0) - 1 };
        return { sl: p.sl + 1, success };
      },
    },
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
    resolve: (s, p, actor) => {
      const a = actor ?? actorIn(s, p.heroId);
      if (!a) return null;
      const t = rollTest(testValue(a, p.skill), 'intermediaire', battleRng());
      return { roll: t.roll, target: t.target, sl: t.sl, success: t.success };
    },
    failed: (p) => (p.roll ?? 0) > (p.target ?? 0),
    // Chance « +1 DR » (`bumpSL`, success intact) + Résistance (Menace) GLOBALES via la lentille : le
    // resist force l'auto-succès à DR = Bonus d'Endurance (LDB 10 l.1015-1021), cible = valeur du Test.
    lens: {
      actorTR: (p) => p.roll != null ? { roll: p.roll, target: p.target ?? 0, success: !!p.success, sl: p.sl ?? 0, isDouble: isDoubleRoll(p.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success }),
      dieTarget: (p, actor) => testValue(actor, p.skill),
    },
  }),

  /** Évaluation (LDB 60 l.10) : révèle la qualité cachée + estime le prix. */
  appraise: makeRollFlow<PendingAppraise>({
    key: 'pendingAppraise',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact).
    caps: { forced: true },
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty);
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    lens: {
      actorTR: (p) => p.roll != null ? { roll: p.roll, target: p.target, success: p.success, sl: p.sl, isDouble: isDoubleRoll(p.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, sl: tr.sl, success: tr.success }),
      dieTarget: (p) => p.target,
    },
  }),

  /** Marchandage (LDB 60 l.12) : Test OPPOSÉ joueur vs marchand — le marchand garde son jet figé. */
  bargain: makeRollFlow<PendingBargain>({
    key: 'pendingBargain',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.playerId),
    touch: touchActors,
    resolve: (_s, p) => {
      const player = rollTest(p.playerSkill, 'intermediaire');
      const merchant = rollTest(p.merchantValue, 'intermediaire');
      return { roll: player, merchantRoll: merchant, result: resolveOpposed(player, merchant) };
    },
    reresolve: (_s, p) => {
      if (p.merchantRoll == null) return null;
      const player = rollTest(p.playerSkill, 'intermediaire');
      return { roll: player, result: resolveOpposed(player, p.merchantRoll) };
    },
    failed: (p) => (p.roll?.roll ?? 0) > (p.roll?.target ?? 0),
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
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    // Chance « +1 DR » (le soin scale avec le DR, LDB 17 l.26) + Résilience GLOBALE via la lentille. Le
    // garde du forceSuccess (déjà réussi, OU mode chirurgie : rien à forcer) vit dans `dieTarget` (→ null),
    // PAS dans `actorTR` — qui sert AUSSI le `bonusSL` (un +1 DR reste offert sur un soin déjà réussi).
    lens: {
      actorTR: (p) => p.roll != null ? { roll: p.roll, target: p.target, success: p.success, sl: p.sl, isDouble: isDoubleRoll(p.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, sl: tr.sl, success: tr.success }),
      dieTarget: (p) => (p.success || p.mode === 'surgery') ? null : p.target,
    },
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
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    // Chance « +1 DR » (la passe scale avec le DR, LDB 17 l.26) + Résilience GLOBALE via la lentille. Le
    // garde du forceSuccess (déjà réussi : rien à forcer) vit dans `dieTarget` (→ null), pas `actorTR`
    // (qui sert aussi le `bonusSL`).
    lens: {
      actorTR: (p) => p.roll != null ? { roll: p.roll, target: p.target, success: p.success, sl: p.sl, isDouble: isDoubleRoll(p.roll) } : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, sl: tr.sl, success: tr.success }),
      dieTarget: (p) => p.success ? null : p.target,
    },
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
  battement:    { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  distraire:    { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  maneuver:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  run:          { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'], coop: true },
  reload:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact'], coop: true },
  recover:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact'], coop: true },
  focus:        { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  dispel:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  frenzy:       { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'], coop: true },
  approach:     { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'] },
  ward:         { kind: 'mono',  verbs: ['roll', 'reroll', 'forceSuccess', 'darkPact'], coop: true },
  heal:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  surgery:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'], coop: true },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'resist'], coop: true },
  test:         { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'cancel'] },
  battleTest:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  activity:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  bargain:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact'] },
  appraise:     { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess'] },
  shanty:       { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'] },
  counterspell: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  cascade:      { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true },
  opposition:   { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'] },
  extendedTest: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  forceDoor:    { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  shipManeuver: { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'] },
  shipBattery:  { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'] },
  crewTest:     { kind: 'multi', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'darkPact'] },
} as const satisfies Record<string, FlowVerbs>;

/** Handler (runtime) par flux — préfixe → `FLOWS.x`. `satisfies Record<keyof typeof FLOW_VERBS, …>`
 *  force l'EXHAUSTIVITÉ : tout flux de `FLOW_VERBS` doit avoir son handler ici (sinon `tsc` casse).
 *  Décorrélé de la clé `FLOWS` (shipBattery→battery, opposition→castOpposition). */
const FLOW_HANDLERS = {
  attack: FLOWS.attack, defense: FLOWS.defense, cast: FLOWS.cast, disengage: FLOWS.disengage, flee: FLOWS.flee,
  auContact: FLOWS.auContact, grapple: FLOWS.grapple, trample: FLOWS.trample, battement: FLOWS.battement,
  distraire: FLOWS.distraire, maneuver: FLOWS.maneuver, run: FLOWS.run, reload: FLOWS.reload, recover: FLOWS.recover,
  focus: FLOWS.focus, dispel: FLOWS.dispel, frenzy: FLOWS.frenzy, approach: FLOWS.approach, ward: FLOWS.ward,
  heal: FLOWS.heal, surgery: FLOWS.surgery, corruption: FLOWS.corruption, test: FLOWS.test, battleTest: FLOWS.battleTest,
  activity: FLOWS.activity, bargain: FLOWS.bargain, appraise: FLOWS.appraise, shanty: FLOWS.shanty,
  counterspell: FLOWS.counterspell, cascade: FLOWS.cascade, opposition: FLOWS.castOpposition, extendedTest: FLOWS.extendedTest,
  forceDoor: FLOWS.forceDoor, shipManeuver: FLOWS.shipManeuver, shipBattery: FLOWS.battery, crewTest: FLOWS.crewTest,
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
