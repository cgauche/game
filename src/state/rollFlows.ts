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
  PendingTrample, PendingManeuver, PendingRun, PendingFocus, PendingFrenzy, PendingApproach, PendingWard,
  PendingReload, PendingStateRecovery, PendingTest, PendingAppraise, PendingBargain, PendingHeal,
  PendingCorruption, PendingAttack, PendingDefense, PendingCast, PendingDisengage,
  PendingCounterspell, CounterParticipant, PendingExtendedTest, ExtendedTestRound,
  PendingForceDoor, ForceDoorParticipant,
  PendingCastOpposition, OppositionParticipant,
  PendingCascade, CascadeStep,
} from './store';
import type { PendingActivity } from './interludeFlow';
import type { Combatant, Weapon } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { makeRollFlow, type RollFlowHandlers } from './rollFlow';
import { battleRng } from './battleRng';
import { actorIn, touchActors } from './combatOrParty';
import {
  TRAMPLE_WEAPON, resolveAttack, firedWeapon, bestDefenseMode, effectiveSpellOf,
  castInfoIsPrayer, disengageOutcome, castWardPenalty, domainCastBonus,
  rollManeuverAttacker, maneuverAttackerDifficulty,
} from './combatFlow';
import { creatureAttacks } from '../engine/creatureAttacks';
import { mountMovement, mountedDodgePenalty } from './mount';
import { sceneCombatModifiers } from './sceneRules';
import { resolveTrample, rederivePassiveAttack, finishMelee, finishRanged, rollMeleeDefender, type AttackResult } from '../engine/combat';
import { reverseRoll } from '../engine/combat';
import { talentReverseFailed, talentTestDR, runMovementBonus } from '../engine/combatFeatures/dispatch';
import { rollTest, resolveOpposed, isDoubleRoll, type TestResult, evaluateTest, maxForcedRoll } from '../engine/tests';
import { resolveRun } from '../engine/movement';
import { testValue } from '../engine/skills';
import { resolveFocus, resolveMagicMissile, resolveCasting, rederiveCastSL, castTestTalentDR, resolveCounterspell, counterspellOutcomeFrom, castTestOf, castingValue } from '../engine/magic';
import { effectiveChar, bonus } from '../engine/characteristics';
import { resolveFrenzyEntry, calmeValue, psychResolution } from '../engine/psychology';
import { findSpellById } from '../data/index';

/** Re-dérive une attaque FIGÉE avec un jet d'attaquant modifié (Chance +1 DR / Résilience / dé
 *  choisi) : Test opposé si un défenseur a joué, attaque passive sinon — partagé attaque/force. */
function rederiveAttack(attacker: Combatant, target: Combatant, p: PendingAttack, atk2: TestResult): AttackResult {
  const weapon = firedWeapon(attacker, target, p.weaponUid); // arme choisie (ou auto) + munition combinée
  const r = p.result!;
  if (r.defenderDetail) {
    const dd = r.defenderDetail;
    const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: isDoubleRoll(dd.roll) };
    return finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), p.location ?? undefined);
  }
  return rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', p.location ?? undefined);
}

/** Résout le résultat d'une défense réactive : TIR DÉFENDU (`finishRanged`, opposition RAW à distance —
 *  Protectrice 2+/Bout Portant/tireur Engagé) OU mêlée (`finishMelee`), selon le type d'arme FIGÉE de
 *  l'attaquant. `p.distanceTiles` sert au breakdown Projectiles ; `parry` = arme de parade choisie. */
function finishDefenseResult(attacker: Combatant, defender: Combatant, p: PendingDefense, def: TestResult, dodgeMod = 0, parry?: Weapon): AttackResult {
  return p.weapon.type === 'ranged'
    ? finishRanged(attacker, defender, p.weapon, p.atk, def, p.mode, p.distanceTiles, p.location ?? undefined, [], parry, dodgeMod)
    : finishMelee(attacker, defender, p.weapon, p.atk, def, p.mode, p.location ?? undefined, [], dodgeMod, undefined, parry);
}

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

/** Les 6 verbes du cycle de jet différé (cf. `RollFlowHandlers`). */
export type RollVerb = 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll';

const capitalize = <S extends string>(s: S): Capitalize<S> =>
  (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<S>;

/** Délégués MONO : `setForcedRoll` prend `(roll)`, les autres `()`. Clé = `${prefix}${Verbe}`. */
export type MonoRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (roll: number) => void : () => void;
};
/** Délégués MULTI : `pid` en tête (slot ciblé) ; `setForcedRoll` prend `(pid, roll)`. */
export type MultiRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (pid: string, roll: number) => void : (pid: string) => void;
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
      : (pid?: string | number) => flow[v](get, set, pid as string);
  }
  return out as MultiRollActions<P, A[number]>;
}

/**
 * Surface EXACTE des délégués de jet exposés par le store (113 clés), dédupliquée. Chaque flux
 * applique le SOUS-ENSEMBLE de verbes qu'il exposait à la main (un flux sans `caps.forced`
 * n'expose ni `…ForceSuccess` ni `…SetForcedRoll` ; certains n'ont ni `…BonusSL`, etc.). Les 5
 * flux MULTI (`counterspell`/`extendedTest`/`forceDoor`/`cascade`/`opposition`) ajoutent `pid`.
 * `GameState extends RollFlowActionsMap` — clés/signatures byte-identiques aux anciennes décls.
 * ⚠️ Le SOUS-ENSEMBLE déclaré ici DOIT coïncider avec celui passé à `rollFlowActions(Multi)` dans
 * le store (typecheck l'impose : l'objet du store doit satisfaire `GameState`).
 */
export type RollFlowActionsMap =
  & MonoRollActions<'activity', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'appraise', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'approach', 'roll' | 'reroll' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'ward', 'roll' | 'reroll' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'attack', 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll'>
  & MonoRollActions<'bargain', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'cast', 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll'>
  & MonoRollActions<'corruption', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'defense', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll'>
  & MonoRollActions<'disengage', 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'focus', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'frenzy', 'roll' | 'reroll' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'heal', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'maneuver', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll'>
  & MonoRollActions<'recover', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'reload', 'roll' | 'reroll' | 'bonusSL' | 'darkPact'>
  & MonoRollActions<'run', 'roll' | 'reroll' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'test', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess'>
  & MonoRollActions<'trample', 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll'>
  & MultiRollActions<'counterspell', RollVerb>
  & MultiRollActions<'extendedTest', RollVerb>
  & MultiRollActions<'forceDoor', RollVerb>
  & MultiRollActions<'cascade', RollVerb>
  & MultiRollActions<'opposition', RollVerb>;

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
          return { result: rederiveAttack(actor, target, p, atk2) };
        }
        // Dé PAR DÉFAUT : on garde le jet courant, forcé à l'emporter.
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, defSL + 1, 1), isDouble: isDoubleRoll(ad.roll) };
        return { result: rederiveAttack(actor, target, p, atk2) };
      }
      const r = resolveAttack(get, actor, target, p.location ?? undefined, p.fromCharge, p.intoCrowd, p.heldGround, p.weaponUid);
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
        return { result: rederiveAttack(actor, target, p, atk2) };
      },
    },
  }),

  /**
   * Défense réactive (héros attaqué par l'IA) : le jet d'attaque (`p.atk`) reste FIGÉ dans tous
   * les cas — seul le jet du défenseur se (re)joue. `defenseConfirm`/`defenseCancel` (métier :
   * reprise du tour IA, « Subir ») restent au store.
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
      const def = rollMeleeDefender(actor, p.mode, battleRng(), dodgeMod, parry, p.weapon);
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
            + castTestTalentDR(actor, castInfoIsPrayer(spell) ? 'Prière' : 'Langue (Magick)');
          return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: forced.roll, sl }, p.missile, p.focused, Math.max(0, ni - sl)) };
        }
        // Dé PAR DÉFAUT (forceSuccess) — plancher : le sort PART (DR ≥ NI), d100 propre réussi.
        return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, p.missile, p.focused, Math.max(1, ni - cur.sl)) };
      }
      // — Jet NORMAL (relance Chance/Pacte) : re-jet complet — wards recalculés (Sorcière LDB 42 + Aqshy LDB 48). —
      const ward = castWardPenalty(s, target, spell) + domainCastBonus(s, actor, spell);
      const res = p.missile
        ? resolveMagicMissile(actor, target, spell, battleRng(), p.focused, ward)
        : resolveCasting(actor, spell, battleRng(), 'intermediaire', p.focused, ward);
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
        const counterT: TestResult = { ...cur.counter, sl: cur.counter.sl + 1 };
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
    caps: { forced: true },
    bonus: {
      derive: (s, part, actor) => {
        const pcCast = s.pendingCast?.result;
        const cur = part.result;
        if (!cur || !pcCast || !actor) return null;
        const castT = castTestOf(pcCast);
        const oppose: TestResult = { ...cur.oppose, sl: cur.oppose.sl + 1 };
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
    // Résilience GLOBALE ; `picker` (dé choisi) UNIQUEMENT sur une Peur de COMBAT (Test ÉTENDU, le DR
    // gagné dépend du dé, LDB 21 l.27) — pas sur une étape BINAIRE (Terreur/cible/Test de scène/nuit/opposé).
    caps: {
      forced: true,
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
          const o = resolveOpposed(opp.aT, { ...def2, sl: def2.sl + (opp.bonusSL ?? 0) });
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
    // Issue BINAIRE → `forced` ignore le dé choisi : la Résilience fait simplement l'emporter.
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor || !p.atk) return null;
      if (forced) {
        if (!p.result || !p.def) return null; // (ancien `force.guard`)
        return { result: 'success' as const }; // l'emporte (LDB ch.17 l.73)
      }
      const def = rollMeleeDefender(actor, 'esquive', battleRng());
      const opp = resolveOpposed(def, p.atk); // mover = « attaquant » du Test opposé
      return { def, result: disengageOutcome(opp.winner) };
    },
    failed: (p) => !p.def?.success,
    bonus: {
      guard: (p) => !!p.def,
      derive: (_s, p) => {
        const def2: TestResult = { ...p.def!, sl: p.def!.sl + 1 };
        const opp = resolveOpposed(def2, p.atk!);
        return { def: def2, result: disengageOutcome(opp.winner) };
      },
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
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, target: res.target, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1 }) },
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
      if (forced) {
        if (p.success) return null; // (ancien `force.guard : !p.success`) — rien à forcer si déjà réussi
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double sur un Test de
        // compétence, le choix rationnel est 01 → DR MAXIMUM (les talents à bonus de DR s'ajoutent
        // comme sur un jet naturel, le seuil `requireSL` reste garanti).
        return {
          roll: 1, success: true,
          sl: Math.max(evaluateTest(1, p.target).sl + (actor ? talentTestDR(actor, p.label) : 0), p.requireSL, 1),
          forced: true,
        };
      }
      let res = rollTest(p.skillValue, p.difficulty);
      // Talents d'INVERSION (LDB 10 — Sociable/Studieux/Lecture rapide/Pharmacologie/Chat de
      // gouttière/Noctambule/Pansement de fortune) : un Test raté est relu chiffres inversés s'il
      // devient réussi (Pansement plafonne à +1 DR).
      if (actor && !res.success) {
        const rev = talentReverseFailed(actor, p.label);
        if (rev) {
          const e = evaluateTest(reverseRoll(res.roll), res.target);
          if (e.success) res = { ...e, isDouble: res.isDouble, sl: rev.capDR != null ? Math.min(e.sl, rev.capDR) : e.sl };
        }
      }
      // Talents à bonus de DR (LDB 10 — Menaçant → Intimidation, Bonnes jambes → Saut…).
      const sl = res.sl + (actor && res.success ? talentTestDR(actor, p.label) : 0);
      return { roll: res.roll, sl, isDouble: res.isDouble, success: res.success && sl >= p.requireSL };
    },
    failed: (p) => (p.roll ?? 0) > p.target, // d100 propre raté (LDB ch.12 l.56 + l.29-31)
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && p.sl + 1 >= p.requireSL }) },
  }),

  /** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance ou de Calme
   *  Intermédiaire (+0) ; le gain de Points dépend du niveau ET du DR (cf. corruptionGain) —
   *  la Chance « +1 DR » peut donc réduire le gain d'une exposition modérée/majeure. */
  corruption: makeRollFlow<PendingCorruption>({
    key: 'pendingCorruption',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    resolve: (s, p) => {
      const actor = actorIn(s, p.heroId);
      if (!actor) return null;
      const t = rollTest(testValue(actor, p.skill), 'intermediaire', battleRng());
      return { roll: t.roll, target: t.target, sl: t.sl, success: t.success };
    },
    failed: (p) => (p.roll ?? 0) > (p.target ?? 0),
    bonus: { derive: (_s, p) => ({ sl: (p.sl ?? 0) + 1, success: (p.roll ?? 0) <= (p.target ?? 0) }) },
  }),

  /** Évaluation (LDB 60 l.10) : révèle la qualité cachée + estime le prix. */
  appraise: makeRollFlow<PendingAppraise>({
    key: 'pendingAppraise',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty);
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && p.sl + 1 >= 0 }) },
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
        const boosted: TestResult = { ...p.roll, sl: p.roll.sl + 1 };
        return { roll: boosted, result: resolveOpposed(boosted, p.merchantRoll) };
      },
    },
  }),

  /** Soin de Guérison (LDB 09) — combat ⇄ hors combat (`actorIn`). La Chirurgie (Test étendu
   *  multi-passes, `surgeryPass`) garde son flux dédié dans le store. */
  heal: makeRollFlow<PendingHeal>({
    key: 'pendingHeal',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.healerId),
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.success || p.mode === 'surgery') return null; // (ancien `force.guard`)
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double, le choix
        // rationnel est 01 → DR MAXIMUM (le soin scale avec le DR : BI + DR Blessures soignées).
        return { roll: 1, success: true, sl: Math.max(evaluateTest(1, p.target).sl, 1) };
      }
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target }) }, // le soin scale avec le DR (LDB 17 l.26)
  }),
};
