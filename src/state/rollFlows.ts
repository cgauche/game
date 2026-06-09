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
  PendingTrample, PendingRun, PendingFocus, PendingPsych, PendingFrenzy,
  PendingReload, PendingStateRecovery, PendingTest, PendingAppraise, PendingBargain, PendingHeal,
} from './store';
import type { Combatant } from '../engine/types';
import { makeRollFlow } from './rollFlow';
import { battleRng } from './battleRng';
import { actorIn } from './combatOrParty';
import { TRAMPLE_WEAPON } from './combatFlow';
import { mountMovement } from './mount';
import { resolveTrample, rederivePassiveAttack } from '../engine/combat';
import { rollTest, resolveOpposed, isDoubleRoll, type TestResult } from '../engine/tests';
import { resolveRun } from '../engine/movement';
import { testValue } from '../engine/skills';
import { resolveFocus } from '../engine/magic';
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
    return { result: { roll: t.roll, success: t.success } };
  }
  if (p.kind === 'terreur') return { result: resolveTerreurTest(calmeValue(actor), p.indice, battleRng()) };
  return { result: resolvePeurTest(calmeValue(actor), p.indice, p.prevDR, battleRng()) };
}

export const FLOWS = {
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
  }),

  /** Course (LDB 15 l.79-82) : Athlétisme (+20) — à cheval, Chevaucher + Mouvement de la monture (LDB 14 l.215). */
  run: makeRollFlow<PendingRun>({
    key: 'pendingRun',
    rolled: (p) => !!p.result,
    actor: (s, p) => inBattle(s, p.combatantId),
    resolve: (s, p, actor) => {
      if (!s.battle || !actor) return null;
      return { result: resolveRun(testValue(actor, actor.mountId ? 'Chevaucher' : 'Athlétisme'), mountMovement(s.battle, actor), battleRng()) };
    },
    failed: (p) => !p.result?.success,
    force: {
      guard: (p) => !p.result?.success,
      derive: (s, p, actor) => {
        if (!s.battle) return null;
        const m = mountMovement(s.battle, actor); // à cheval : Mouvement de la monture (LDB 14 l.215)
        const base = p.result;
        // RAW LDB 17 l.73 : avant le jet (result==null → on choisit 01) OU après un échec.
        return { result: { success: true, roll: base?.roll ?? 1, dr: Math.max(0, base?.dr ?? 0), bonusCases: Math.max(base?.bonusCases ?? 0, 2 * m) } };
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
        // RAW LDB 17 l.73 : avant le jet (result==null → choisit 01) OU après un échec.
        return { result: { dr: Math.max(base?.dr ?? 0, 1), isCritical: base?.isCritical ?? false, isFumble: false, roll: base?.roll ?? 1, log: `${actor.name} force la focalisation (Résilience).` } };
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
      derive: (_s, p) => ({ result: { success: true, roll: p.result?.roll ?? 1 } }),
    },
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
    resolve: (_s, p) => {
      const res = rollTest(p.skillValue, p.difficulty);
      return { roll: res.roll, sl: res.sl, isDouble: res.isDouble, success: res.success && res.sl >= p.requireSL };
    },
    failed: (p) => (p.roll ?? 0) > p.target, // d100 propre raté (LDB ch.12 l.56 + l.29-31)
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && p.sl + 1 >= p.requireSL }) },
    force: {
      guard: (p) => !p.success, // rien à forcer si déjà réussi
      // RAW LDB 17 l.73 : AVANT le jet (« au lieu de lancer les dés » → on choisit 01) OU après un échec.
      derive: (_s, p) => ({ roll: p.roll ?? 1, success: true, sl: Math.max(p.sl, p.requireSL, 1), forced: true }),
    },
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
      // RAW LDB 17 l.73 : AVANT le jet (roll==null → on choisit 01) OU après un échec (roll conservé).
      derive: (_s, p) => ({ roll: p.roll ?? 1, success: true, sl: Math.max(p.sl, 1) }),
    },
  }),
};
