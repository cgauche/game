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
  PendingTrample, PendingRun, PendingFocus, PendingPsych, PendingFrenzy, PendingApproach,
  PendingReload, PendingStateRecovery, PendingTest, PendingAppraise, PendingBargain, PendingHeal,
  PendingCorruption, PendingAttack, PendingDefense, PendingCast, PendingDisengage,
} from './store';
import type { PendingActivity } from './interludeFlow';
import type { Combatant } from '../engine/types';
import { makeRollFlow } from './rollFlow';
import { battleRng } from './battleRng';
import { actorIn } from './combatOrParty';
import {
  TRAMPLE_WEAPON, resolveAttack, firedWeapon, bestDefenseMode, effectiveSpellOf,
  castInfoIsPrayer, disengageOutcome, castWardPenalty, domainCastBonus,
} from './combatFlow';
import { mountMovement, mountedDodgePenalty } from './mount';
import { sceneCombatModifiers } from './sceneRules';
import { resolveTrample, rederivePassiveAttack, finishMelee, rollMeleeDefender, type AttackResult } from '../engine/combat';
import { reverseRoll } from '../engine/combat';
import { talentReverseFailed, talentTestDR, runMovementBonus } from '../engine/combatFeatures/dispatch';
import { rollTest, resolveOpposed, isDoubleRoll, type TestResult, evaluateTest } from '../engine/tests';
import { resolveRun } from '../engine/movement';
import { testValue } from '../engine/skills';
import { resolveFocus, resolveMagicMissile, resolveCasting, rederiveCastSL, castTestTalentDR } from '../engine/magic';
import { effectiveChar } from '../engine/characteristics';
import {
  resolvePeurTest, resolveTerreurTest, resolveCalmeSimple, resolveFrenzyEntry, calmeValue, CIBLE_TYPES,
} from '../engine/psychology';
import { findSpell } from '../data/index';

/** Acteur dans la file de combat (flux strictement en-combat). */
const inBattle = (s: GameState, id: string): Combatant | undefined =>
  s.battle?.combatants.find((c) => c.id === id);
/** Acteur dans le groupe (flux d'exploration : Test de scène, marchand). */
const inParty = (s: GameState, id: string): Combatant | undefined =>
  s.party.find((c) => c.id === id);
/** Re-rendu côté groupe (les flux d'exploration patchaient historiquement `party`, pas `battle`). */
const touchParty = (s: GameState): Partial<GameState> => ({ party: [...s.party] });

/** Résolution du Test de Psychologie (LDB 21) — partagée entre `roll` et `reroll` (re-jet complet). */
function psychResolve(s: GameState, p: PendingPsych, actor: Combatant | undefined) {
  if (!s.battle || !actor) return null;
  if (CIBLE_TYPES.has(p.kind)) {
    const t = resolveCalmeSimple(calmeValue(actor), battleRng());
    return { result: { roll: t.roll, success: t.success, target: t.target, sl: t.sl } };
  }
  if (p.kind === 'terreur') return { result: resolveTerreurTest(calmeValue(actor), p.indice, battleRng()) };
  return { result: resolvePeurTest(calmeValue(actor), p.indice, p.prevDR, battleRng()) };
}

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

export const FLOWS = {
  /**
   * Attaque (modale différée). Le JET INITIAL reste métier (`attackRoll` : +1 Avantage si cible
   * Sonnée, annulation hors portée/LdV, victime de déviation dans la mêlée) — comme `attackConfirm`.
   * Le cycle Chance/Pacte/Résilience/dé choisi vit ICI, identique à tous les flux.
   */
  attack: makeRollFlow<PendingAttack>({
    key: 'pendingAttack',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.attackerId),
    // Relance (Chance/Pacte) : re-résolution complète — mêmes environnement et options de tir.
    resolve: (s, p, actor, get) => {
      const target = inBattle(s, p.targetId);
      if (!actor || !target) return null;
      const r = resolveAttack(get, actor, target, p.location ?? undefined, p.fromCharge, p.intoCrowd, p.heldGround, p.weaponUid);
      return r ? { result: r.res, victimId: r.victim?.id } : null;
    },
    // 2ᵉ frappe du Maniement de deux armes : jet IMPOSÉ (d100 inversé) — ni relance ni Pacte.
    failed: (p) => !p.dualSecond && !!p.result && !p.result.attackerDetail?.success,
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = inBattle(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
        return { result: rederiveAttack(actor, target, p, atk2) };
      },
    },
    force: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = inBattle(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        // Test opposé : « vous l'emportez avec au moins DR +1 » (LDB 17 l.73).
        const defSL = p.result!.defenderDetail?.sl ?? 0;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, defSL + 1, 1), isDouble: isDoubleRoll(ad.roll) };
        return { result: rederiveAttack(actor, target, p, atk2) };
      },
    },
    // « vous choisissez le résultat » : 11 → Coup Critique (l'exemple Salundra l.75) ; 01 → DR max ;
    // les unités nourrissent Percutante/Dévastatrice et la localisation inversée.
    forceRoll: {
      derive: (s, p, actor, roll) => {
        const target = inBattle(s, p.targetId);
        const ad = p.result?.attackerDetail;
        if (!target || !ad || roll > Math.min(99, ad.target)) return null; // doit RESTER une réussite
        const defSL = p.result!.defenderDetail?.sl ?? 0;
        const sl = Math.max(evaluateTest(roll, ad.target).sl, defSL + 1, 1);
        const atk2: TestResult = { roll, target: ad.target, success: true, sl, isDouble: isDoubleRoll(roll) };
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
    actor: (s, p) => inBattle(s, p.defenderId),
    resolve: (s, p, actor) => {
      const attacker = inBattle(s, p.attackerId);
      if (!attacker || !actor) return null;
      // Neige −20 + cavalier −20 (LDB 14 l.115-116/225) ; Rapide : −10 à la parade d'une arme non-Rapide (LDB 62 l.320).
      const dodgeMod = (s.scene ? sceneCombatModifiers(s.scene, s.gameTime).dodgeMod : 0) + mountedDodgePenalty(actor);
      const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
      const def = rollMeleeDefender(actor, p.mode, battleRng(), dodgeMod, parry, p.weapon);
      return { def, result: finishMelee(attacker, actor, p.weapon, p.atk, def, p.mode, p.location ?? undefined, [], dodgeMod, undefined, parry) };
    },
    failed: (p) => !!p.result && !p.def?.success,
    bonus: {
      guard: (p) => !!p.result?.defenderDetail,
      derive: (s, p, actor) => {
        const attacker = inBattle(s, p.attackerId);
        if (!attacker) return null;
        const dd = p.result!.defenderDetail!;
        const def2: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl + 1, isDouble: isDoubleRoll(dd.roll) };
        const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
        return { def: def2, result: finishMelee(attacker, actor, p.weapon, p.atk, def2, p.mode, p.location ?? undefined, [], 0, undefined, parry) };
      },
    },
    force: {
      guard: (p) => !!p.result?.defenderDetail && !!p.def,
      derive: (s, p, actor) => {
        const attacker = inBattle(s, p.attackerId);
        if (!attacker) return null;
        const dd = p.result!.defenderDetail!;
        // Test opposé : « vous l'emportez avec au moins DR +1 » (LDB 17 l.73).
        const def2: TestResult = { roll: dd.roll, target: dd.target, success: true, sl: Math.max(dd.sl, p.atk.sl + 1, 1), isDouble: isDoubleRoll(dd.roll) };
        return { def: def2, result: finishMelee(attacker, actor, p.weapon, p.atk, def2, p.mode, p.location ?? undefined) };
      },
    },
    forceRoll: {
      derive: (s, p, actor, roll) => {
        const attacker = inBattle(s, p.attackerId);
        if (!attacker || !p.def || roll > Math.min(99, p.def.target)) return null; // doit RESTER une réussite
        const sl = Math.max(evaluateTest(roll, p.def.target).sl, p.atk.sl + 1, 1);
        const def2: TestResult = { roll, target: p.def.target, success: true, sl, isDouble: isDoubleRoll(roll) };
        return { def: def2, result: finishMelee(attacker, actor, p.weapon, p.atk, def2, p.mode, p.location ?? undefined) };
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
    // Relance (Chance/Pacte) : re-jet complet — wards recalculés (Sorcière LDB 42 + Aqshy LDB 48).
    resolve: (s, p, actor) => {
      const target = actorIn(s, p.targetId);
      const spell = effectiveSpellOf(p); // NI ×2 si lecture au grimoire (LDB 47 l.34)
      if (!actor || !target || !spell) return null;
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
    force: {
      guard: (p) => !!p.result,
      // Plancher : le sort PART (DR ≥ NI) — on force aussi un d100 propre réussi.
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        const spell = effectiveSpellOf(p);
        if (!target || !spell) return null;
        const ni = p.focused ? 0 : spell.cn ?? 0;
        const cur = p.result!;
        return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, p.missile, p.focused, Math.max(1, ni - cur.sl)) };
      },
    },
    // « vous choisissez le résultat » : 11 → Incantation Critique ; 01 → DR max → Surincantation.
    forceRoll: {
      derive: (s, p, actor, roll) => {
        const target = actorIn(s, p.targetId);
        const spell = effectiveSpellOf(p);
        if (!target || !spell || !p.result || roll > Math.min(99, p.result.target)) return null;
        const ni = p.focused ? 0 : spell.cn ?? 0;
        const sl = evaluateTest(roll, p.result.target).sl
          + castTestTalentDR(actor, castInfoIsPrayer(spell.type) ? 'Prière' : 'Langue (Magick)');
        return { result: rederiveCastSL(actor, target, spell, { ...p.result, roll, sl }, p.missile, p.focused, Math.max(0, ni - sl)) };
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
    actor: (s, p) => inBattle(s, p.moverId),
    resolve: (s, p, actor) => {
      if (!actor || !p.atk) return null;
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
    force: {
      guard: (p) => !!p.result && !!p.def,
      derive: () => ({ result: 'success' as const }), // l'emporte (LDB ch.17 l.73)
    },
  }),

  /** Piétinement (LDB 85 l.320-321) : attaque de Bagarre, action gratuite à 1 Avantage. */
  trample: makeRollFlow<PendingTrample>({
    key: 'pendingTrample',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.attackerId),
    resolve: (s, p, actor) => {
      const target = inBattle(s, p.targetId);
      if (!actor || !target) return null;
      return { result: resolveTrample(actor, target, battleRng()) };
    },
    failed: (p) => !p.result?.attackerDetail?.success,
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = inBattle(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      },
    },
    force: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = inBattle(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, 1), isDouble: isDoubleRoll(ad.roll) };
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      },
    },
    // « vous choisissez le résultat » (LDB 17 l.73) : un Piétinement est une attaque — un double
    // choisi (11) inflige un Coup Critique, comme l'exemple Salundra (l.75).
    forceRoll: {
      derive: (s, p, actor, roll) => {
        const target = inBattle(s, p.targetId);
        const ad = p.result?.attackerDetail;
        if (!target || !ad || roll > Math.min(99, ad.target)) return null; // doit RESTER une réussite
        const atk2: TestResult = { roll, target: ad.target, success: true, sl: Math.max(evaluateTest(roll, ad.target).sl, 1), isDouble: isDoubleRoll(roll) };
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee') };
      },
    },
  }),

  /** Course (LDB 15 l.79-82) : Athlétisme (+20) — à cheval, Chevaucher + Mouvement de la monture (LDB 14 l.215). */
  run: makeRollFlow<PendingRun>({
    key: 'pendingRun',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.combatantId),
    resolve: (s, p, actor) => {
      if (!s.battle || !actor) return null;
      // Sprinter (LDB 10) : « Votre Attribut de Mouvement compte comme plus élevé de 1 lorsque vous Courez. »
      return { result: resolveRun(testValue(actor, actor.mountId ? 'Chevaucher' : 'Athlétisme'), mountMovement(s.battle, actor) + runMovementBonus(actor), battleRng()) };
    },
    failed: (p) => !p.result?.success,
    force: {
      guard: (p) => !p.result?.success,
      derive: (s, p, actor) => {
        if (!s.battle) return null;
        const m = mountMovement(s.battle, actor); // à cheval : Mouvement de la monture (LDB 14 l.215)
        const base = p.result;
        // RAW LDB 17 l.73 : avant le jet (result==null → on choisit 01) OU après un échec.
        return { result: { success: true, roll: base?.roll ?? 1, target: base?.target, dr: Math.max(0, base?.dr ?? 0), bonusCases: Math.max(base?.bonusCases ?? 0, 2 * m) } };
      },
    },
  }),

  /** Focalisation (Test étendu de magie) — vaut en combat ET hors combat (`actorIn`). */
  focus: makeRollFlow<PendingFocus>({
    key: 'pendingFocus',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    resolve: (s, p, actor) => {
      const spell = findSpell(p.spellLabel);
      if (!actor || !spell) return null;
      return { result: resolveFocus(actor, spell, battleRng()) };
    },
    failed: (p) => p.result?.dr === 0, // aucun DR gagné → rejouable
    bonus: {
      derive: (_s, p) => ({ result: { ...p.result!, dr: p.result!.dr + 1, log: `${p.result!.log} (+1 DR)` } }),
    },
    force: {
      derive: (_s, p, actor) => {
        const base = p.result;
        // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double, le choix
        // rationnel est 01 → DR MAXIMUM quand la cible du Test est connue (post-échec) ;
        // pré-jet (résultat synthétique sans cible), plancher DR 1 comme avant.
        const sl = base?.target != null ? Math.max(evaluateTest(1, base.target).sl, 1) : Math.max(base?.sl ?? 1, 1);
        return { result: { dr: Math.max(base?.dr ?? 0, sl), isCritical: base?.isCritical ?? false, isFumble: false, roll: 1, target: base?.target, sl, log: `${actor.name} force la focalisation (Résilience).` } };
      },
    },
  }),

  /** Test de Psychologie héros (Peur/Terreur/Traits ciblés, LDB 21) — pas d'« Annuler » (Test obligatoire). */
  psych: makeRollFlow<PendingPsych>({
    key: 'pendingPsych',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.combatantId),
    resolve: psychResolve,
    failed: (p) =>
      CIBLE_TYPES.has(p.kind) || p.kind === 'terreur' ? !p.result?.success : (p.result?.dr ?? 0) === 0,
    bonus: {
      guard: (p) => !CIBLE_TYPES.has(p.kind), // ciblé = Test binaire (pas de « +1 DR »)
      derive: (_s, p) => {
        const r = p.result!;
        return {
          result: p.kind === 'terreur'
            ? { ...r, brise: Math.max(p.indice, (r.brise ?? 0) - 1) } // +1 DR réduit le Brisé (plancher = Indice)
            : { ...r, calmeDR: (r.calmeDR ?? 0) + 1, vaincue: (r.calmeDR ?? 0) + 1 >= p.indice },
        };
      },
    },
    force: {
      derive: (_s, p) => {
        // RAW LDB 17 l.73 : avant le jet (result==null → base 01) OU après un échec.
        const r = p.result ?? { roll: 1 };
        return {
          result: CIBLE_TYPES.has(p.kind)
            ? { ...r, success: true }
            : p.kind === 'terreur'
              ? { ...r, success: true, brise: 0 }
              : { ...r, calmeDR: p.indice, vaincue: true },
        };
      },
    },
  }),

  /** Entrée en Frénésie (LDB 21 l.31-36) : Test de FM. */
  frenzy: makeRollFlow<PendingFrenzy>({
    key: 'pendingFrenzy',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.combatantId),
    resolve: (s, p, actor) => (s.battle && actor ? { result: resolveFrenzyEntry(effectiveChar(actor, 'FM'), battleRng()) } : null),
    failed: (p) => !p.result?.success,
    force: {
      guard: (p) => !p.result?.success,
      // RAW LDB 17 l.73 : avant le jet (result==null → choisit 01) OU après un échec.
      derive: (_s, p) => ({ result: { success: true, roll: p.result?.roll ?? 1, target: p.result?.target } }),
    },
  }),

  /** Approche d'une source de Peur (LDB 21 l.29) : Test SEC de Calme Intermédiaire (+0) pour oser
   *  se rapprocher — distinct du Test étendu qui VAINC la Peur (flux `psych`). */
  approach: makeRollFlow<PendingApproach>({
    key: 'pendingApproach',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.combatantId),
    resolve: (_s, _p, actor) => {
      if (!actor) return null;
      const t = rollTest(calmeValue(actor), 'intermediaire', battleRng());
      return { result: { success: t.success, roll: t.roll, target: t.target, sl: t.sl } };
    },
    failed: (p) => !p.result?.success,
    force: {
      guard: (p) => !p.result?.success,
      // RAW LDB 17 l.73 : avant le jet (result==null → choisit 01) OU après un échec.
      derive: (_s, p) => ({ result: { success: true, roll: p.result?.roll ?? 1, target: p.result?.target, sl: Math.max(p.result?.sl ?? 0, 0) } }),
    },
  }),

  /** Activité d'interlude (LDB 23) : Revenus (Test Accessible de la compétence de carrière,
   *  LDB 08 l.135) ou lancer d'Artisanat (Test ÉTENDU de Métier — le DR se cumule à l'Appliquer). */
  activity: makeRollFlow<PendingActivity>({
    key: 'pendingActivity',
    rolled: (p) => p.roll != null,
    actor: (s, p) => inParty(s, p.heroId),
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, target: res.target, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1 }) },
    touch: touchParty,
  }),

  /** Rechargement (LDB 63 l.28-29) : Test ÉTENDU de Projectiles — le DR se cumule à l'Appliquer. */
  reload: makeRollFlow<PendingReload>({
    key: 'pendingReload',
    rolled: (p) => p.roll != null,
    actor: (s, p) => inBattle(s, p.actorId),
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
    actor: (s, p) => inBattle(s, p.actorId),
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
    actor: (s, p) => inParty(s, p.actorId),
    touch: touchParty,
    resolve: (s, p) => {
      const actor = inParty(s, p.actorId);
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
    force: {
      guard: (p) => !p.success, // rien à forcer si déjà réussi
      // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double sur un Test de
      // compétence, le choix rationnel est 01 → DR MAXIMUM (les talents à bonus de DR s'ajoutent
      // comme sur un jet naturel, le seuil `requireSL` reste garanti).
      derive: (_s, p, actor) => ({
        roll: 1, success: true,
        sl: Math.max(evaluateTest(1, p.target).sl + (actor ? talentTestDR(actor, p.label) : 0), p.requireSL, 1),
        forced: true,
      }),
    },
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
    actor: (s, p) => inParty(s, p.actorId),
    touch: touchParty,
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
    actor: (s, p) => inParty(s, p.playerId),
    touch: touchParty,
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
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      return { roll: res.roll, sl: res.sl, success: res.success };
    },
    failed: (p) => (p.roll ?? 0) > p.target,
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target }) }, // le soin scale avec le DR (LDB 17 l.26)
    force: {
      guard: (p) => !p.success && p.mode !== 'surgery',
      // RAW LDB 17 l.73 « vous choisissez le résultat » : sans enjeu de double, le choix
      // rationnel est 01 → DR MAXIMUM (le soin scale avec le DR : BI + DR Blessures soignées).
      derive: (_s, p) => ({ roll: 1, success: true, sl: Math.max(evaluateTest(1, p.target).sl, 1) }),
    },
  }),
};
