/**
 * EXÉCUTEUR DE FLOW cadence-aware « aucun jet de héros en silence » — résout un nœud `test` d'un Flow
 * selon le CONTEXTE (scène / combat × cadence) et reprend la CONTINUATION `after` (le reste du `seq`).
 *
 * Module FEUILLE (chargé par effet de bord depuis combatFlow, qui le `export *`) : il n'importe RIEN
 * de combatFlow. Il REJOINT la voie unifiée existante (`pushCombatStep` → cascade `purpose:'combat'`
 * influençable + `registerCascadeApplier` + `runSpellFlowLines`) au lieu d'inventer un système.
 *
 * Trois entrées, UN résolveur :
 *  - `resolveFlowTest(ctx, node, after)` — point de décision unique sur un nœud `test` :
 *    · scène → `openSkillTest` (modale `pendingTest`, source unique) ;
 *    · combat + héros MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE (suspend) ;
 *    · combat sinon (ennemi / cadence auto) → jet INLINE (`rollTest`) + branche + `after`, lignes
 *      poussées dans la file de journal différée (`pendingLogQueue`, déversée au rendu).
 *  - `runCombatFlow(ctx, flow)` — exécuteur à PILE d'un Flow EN COMBAT (calque `runFlow` côté scène) :
 *    porte la continuation `after` (sur un `test`, `after = reste de la pile`).
 *  - `routeTriggeredTest` — l'entrée des triggers portant un nœud `test` (Mâchoires `onGainCondition`,
 *    Venin/Hurlement/2 enchants `onHit`) : délègue à `runCombatFlow` (test top-level = IDENTIQUE au Lot 0 ;
 *    test enfoui = suspendu avec `after`).
 *
 * Les branches `onSuccess`/`onFail` + la continuation `after` voyagent dans le `meta` (sérialisable,
 * coop) ; l'applier `triggeredTest` les rejoue (branche PUIS `after`) — l'`ExecCtx` est RECONSTRUIT
 * depuis `get()`/`hero`, jamais capturé (zéro closure dans le pending).
 */
import { rollTest, resolveOpposed, type TestResult } from '../../engine/tests';
import { combatTestPenalty } from '../../engine/conditions';
import { testValue } from '../../engine/skills';
import { applyOps, describeTestRoll, type OpsCtx } from '../../engine/ops';
import { DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../../engine/types';
import type { Combatant, Difficulty } from '../../engine/types';
import { SIZE_ORDER, effectiveSize } from '../../engine/size';
import { campOf } from '../../engine/relations';
import { immunityTypes } from '../../engine/traits/dispatch';
import { groupMatch } from '../../engine/groups';
import { refLabel } from '../../data';
import { type Flow, type ActorView, type ConditionCtx, evalCondition, conditionCtx, EMPTY_FLOW } from '../flow';
import type { Get, Set as SetFn } from '../flowTypes';
import { battleRng } from '../battleRng';
import { runSpellFlowLines, runFlow, pushCombatStep, openSkillTest } from '../combatEffects';
import { registerCascadeApplier } from '../cascade';
import { fireTriggers } from '../triggeredEffects';
import { roundTestInteractive } from './roundHooks';

/** Reflète la mutation EN PLACE d'un combattant (États retirés) dans les références party/battle pour
 *  un re-rendu React (clone des tableaux) — mirroir de `syncCombatant` des appliers d'upkeep. */
function syncCombatant(get: Get, set: SetFn): void {
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
}

/** Pousse des lignes de journal d'un effet inline dans la file différée (déversée au rendu) — un hook
 *  profond fire AVANT le `set(battle.log)` final → on passe par la file (`drainPendingLog`, §5). */
function queueLines(get: Get, set: SetFn, lines: string[], cid: string): void {
  if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid }))] });
}

/**
 * Environnement d'exécution d'un Flow — état (get/set) + MODE (scène vs combat) et, en combat, les
 * combattants en jeu (`target`/`caster`) + le contexte d'incantation (`opsCtx` : sl/durée/location…).
 * Reconstruit à chaque besoin (jamais sérialisé) : porte uniquement des références vivantes + le mode.
 */
export interface ExecCtx {
  mode: 'scene' | 'combat';
  get: Get;
  set: SetFn;
  /** Cible du sous-Flow (combat) — porteur par défaut des feuilles `on:'target'` et référent du Test. */
  target?: Combatant;
  /** Lanceur/porteur (combat) — référent des feuilles `on:'caster'` et des formules « (X) ». */
  caster?: Combatant;
  /** Libellé de source (journal / ActiveEffect). */
  label: string;
  /** Contexte d'incantation des ops (combat) : sl/durée/location/woundsDealt… (cf. `OpsCtx`). */
  opsCtx?: OpsCtx;
}

/** Vue d'un combattant pour la Condition `compare`/`relation`/`has` (PB + Taille/Avantage + camp +
 *  Groupes/Talents/Traits + valeur d'États par nom). Source unique (combat). */
function actorView(c: Combatant | undefined): ActorView | undefined {
  return c ? {
    id: c.id, woundsCurrent: c.wounds.current, woundsMax: c.wounds.max, size: SIZE_ORDER[effectiveSize(c.size)],
    advantage: c.advantage ?? 0, camp: campOf(c),
    groups: c.groups ?? [], talents: (c.talents ?? []).map((t) => ({ id: t.talentId, spec: t.spec })), traits: (c.traits ?? []).map((t) => t.id),
    conditions: Object.fromEntries(c.conditions.map((x) => [x.name, x.value ?? 1])),
  } : undefined;
}

/**
 * SOURCE UNIQUE du `ConditionCtx` d'un nœud `if` : scène → `conditionCtx(get())` (drapeaux/horloge/
 * groupe/bourse) ; combat → vues des acteurs (`target`/`caster`) + sl/location/woundsDealt/attackKind
 * du contexte d'incantation. Utilisée par `runCombatFlow` (et, côté scène, identique à `runFlow`).
 */
export function condCtxFor(ctx: ExecCtx): ConditionCtx {
  if (ctx.mode === 'scene') return conditionCtx(ctx.get());
  const o = ctx.opsCtx ?? {};
  return {
    flags: {}, gameTime: o.now ?? 0, party: ctx.target ? [ctx.target] : [], sl: o.sl,
    location: o.location, woundsDealt: o.woundsDealt, attackKind: o.attackKind,
    target: actorView(ctx.target), caster: actorView(ctx.caster),
  };
}

/** Conséquence PARTAGÉE des deux branches (héros cascade ⇄ ennemi/auto inline) : exécute la branche
 *  `onSuccess`/`onFail` via `runSpellFlowLines` sur `c` (référent = lui-même), `ctx.sl = t.sl` alimentant
 *  les échelles `valuePerSL` (« chaque DR supprime un État Sonné supplémentaire »). Renvoie le journal de
 *  la BRANCHE (string[] tissé au bon canal : return cascade `{ journal }` / file inline) — la branche est
 *  un Flow de feuilles `do`/`if` (aucun nœud `test` enfoui aujourd'hui ; un Test chaîné serait une
 *  continuation `after`, pas une branche). La continuation `after` est jouée À PART (`playAfter`), APRÈS
 *  les lignes de branche → ordre du journal correct. */
export function applyTriggeredTestBranch(
  c: Combatant, t: Pick<TestResult, 'success' | 'sl'>, branches: { onSuccess: Flow; onFail: Flow },
): string[] {
  return runSpellFlowLines(c, c, t.success ? branches.onSuccess : branches.onFail, { rng: battleRng(), caster: c, sl: t.sl });
}

/** Rejoue la CONTINUATION `after` d'un `test` (le reste du `seq`) sur `c` EN COMBAT (peut ré-appender
 *  une étape `triggeredTest` à la cascade). No-op pour un `after` vide (Test top-level = Mâchoires). */
function playAfter(get: Get, set: SetFn, c: Combatant, after: Flow | undefined, label: string): void {
  if (after && after !== EMPTY_FLOW) runCombatFlow({ mode: 'combat', get, set, target: c, caster: c, label }, after);
}

/**
 * EXÉCUTEUR à PILE d'un Flow EN COMBAT — calque `runFlow` (côté scène) pour porter la CONTINUATION : un
 * nœud `test` enfoui suspend en empaquetant le reste de la pile dans `after` puis délègue à
 * `resolveFlowTest`. `do` ops → `applyOps` sur la bonne cible (`on:'caster'`/`target`) ; `if` → branche
 * sur `condCtxFor`. Le journal part dans la file différée (`pendingLogQueue`). Pas de boucle → termine.
 */
export function runCombatFlow(ctx: ExecCtx, flow: Flow): void {
  const stack: Flow[] = [flow];
  const oc: OpsCtx = { rng: battleRng(), caster: ctx.caster, ...ctx.opsCtx };
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'seq': stack.unshift(...node.steps); break;
      case 'do': {
        if (node.effect.type === 'ops') {
          const unit = node.effect.on === 'caster' ? ctx.caster : ctx.target;
          if (unit) { const lines = applyOps(unit, node.effect.ops, oc); syncCombatant(ctx.get, ctx.set); queueLines(ctx.get, ctx.set, lines, unit.id); }
        }
        break;
      }
      case 'if': {
        const branch = evalCondition(node.cond, condCtxFor(ctx)) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        resolveFlowTest(ctx, node, after);
        return;
      }
    }
  }
}

/**
 * POINT DE DÉCISION UNIQUE sur un nœud `test`. `target` = le combattant qui jette (référent = la cible
 * du sous-Flow) ; `after` = continuation reprise APRÈS la branche.
 *  - scène → `openSkillTest` (modale, source unique) ; aucun héros ne peut tenter → on saute au `after`.
 *  - combat + héros MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE (Chance/Pacte/Résilience) ;
 *    on ne touche QUE `pendingCascade` (jamais `battle.log` depuis ce hook profond).
 *  - combat sinon (ennemi / cadence auto) → jet INLINE + branche + `after`, lignes → file différée.
 *
 * Test OPPOSÉ (`ft.opposed`, Assommante LDB 62 l.268) : l'ATTAQUANT (`ctx.caster`, le porteur) est
 * PRÉ-JETÉ et FIGÉ (`aT`) AVANT que le défenseur (`c`) ne jette — l'issue success/sl du défenseur vient
 * de `resolveOpposed(jetDéfenseur, aT)` (PAS `roll ≤ target`). Côté héros manuel, `aT` voyage dans
 * `meta.opposed` (sérialisable, coop) et la cascade re-oppose à chaque influence (calque `recover`/
 * `disengage`) ; côté ennemi/auto, on re-oppose INLINE. Le défenseur RÉSISTE (branche `success`) si
 * l'attaquant ne l'emporte PAS (défenseur OU ÉGALITÉ).
 */
export function resolveFlowTest(ctx: ExecCtx, node: Extract<Flow, { kind: 'test' }>, after: Flow): void {
  const ft = node.test;
  if (ctx.mode === 'scene') {
    // Source unique de modale. Personne ne peut tenter (aucun héros vivant) → on reprend directement la
    // continuation de scène via `runFlow` (mirroir du `runFlow.case 'test'` côté combatEffects).
    if (!openSkillTest(ctx.get, ctx.set, ft, node.success, node.fail, after)) runFlow(ctx.get, ctx.set, after, ctx.label);
    return;
  }
  const c = ctx.target!;
  // Gates de l'op `test` reportées sur le nœud (sémantique IDENTIQUE) — évaluées AVANT de poser l'étape /
  // jeter : la cible est connue (combat). Gate non passée ⇒ no-op (ni étape ni branche, comme l'op
  // `break`) MAIS la continuation `after` est jouée (= ops suivantes du `do` d'origine).
  const gated =
    (ft.unlessImmune != null && immunityTypes(c.traits ?? []).some((ty) => ty.includes(ft.unlessImmune!.toLowerCase())))
    || (ft.onlyGroups != null && !ft.onlyGroups.some((g) => groupMatch(g, c.groups ?? [])))
    || (ft.exceptGroups != null && ft.exceptGroups.some((g) => groupMatch(g, c.groups ?? [])));
  if (gated) { playAfter(ctx.get, ctx.set, c, after, ctx.label); return; }
  const opp = ft.opposed;
  const base = testValue(c, ft.skill, ft.characteristic, ft.spec);
  const difficulty: Difficulty = ft.difficulty ?? 'intermediaire';
  const skillLabel = ft.skill ? refLabel('skills', { id: ft.skill, spec: ft.spec }) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const label = ft.label ?? skillLabel;
  // Test OPPOSÉ : aucune pénalité d'État supplémentaire (l'op `opposedTest` jetait `testValue` brut des
  // deux côtés — `testValue` porte DÉJÀ les pénalités d'États ; pas de `combatTestPenalty` en plus). Test
  // SIMPLE : `combatTestPenalty` comme l'ancien op `test` (byte-fidèle aux chemins Venin/Mâchoires).
  const penalty = opp ? 0 : combatTestPenalty(c);
  // Test OPPOSÉ : PRÉ-JET de l'attaquant (porteur), FIGÉ, AVANT le jet du défenseur — même ordre RNG que
  // `opposedTest()` (attaquant puis défenseur). Référent = `ctx.caster` (Force du porteur).
  const attacker = opp ? ctx.caster : undefined;
  const aT: TestResult | undefined = opp && attacker
    ? rollTest(testValue(attacker, opp.attackerSkill, opp.attacker), 'intermediaire', battleRng())
    : undefined;
  if (roundTestInteractive(c)) {
    // Héros en cadence manuelle : étape INFLUENÇABLE, suspendue dans la cascade de combat. La branche +
    // la continuation `after` voyagent dans le meta (sérialisable) → rejouées par l'applier. En Test
    // OPPOSÉ, l'attaquant figé `aT` voyage aussi dans le meta → la cascade re-oppose à chaque influence.
    pushCombatStep(ctx.set, {
      id: `triggeredTest-${c.id}-${skillLabel}`,
      kind: 'triggeredTest', actorId: c.id, icon: '🎲', rollLabel: skillLabel,
      base, target: base + DIFFICULTY_MODIFIERS[difficulty] + penalty, label,
      meta: {
        onSuccess: node.success, onFail: node.fail, after,
        ...(aT && attacker ? { opposed: { aT, attackerName: attacker.name, attackerLabel: opp!.attackerLabel ?? CHAR_LABELS[opp!.attacker] } } : {}),
      },
    });
    return;
  }
  // Ennemi OU héros rapide/auto : jet INLINE + branche + continuation ; ligne de parité.
  // `skillLabel` = la Compétence/Caractéristique RÉELLE (cadre de jet), distincte du `label` de situation.
  const t = rollTest(base, difficulty, battleRng(), penalty);
  if (opp && aT && attacker) {
    // Test OPPOSÉ inline : l'attaquant figé (1ʳᵉ position) vs le jet du défenseur → le défenseur RÉSISTE
    // (success) si l'attaquant ne l'emporte PAS (défenseur vainqueur OU égalité). `t.success`/`t.sl` du
    // jet simple sont REMPLACÉS par l'issue opposée (LDB 62 l.268).
    const o = resolveOpposed(aT, t);
    const defenderResists = o.winner !== 'attacker';
    queueLines(ctx.get, ctx.set, [
      `${attacker.name} (${opp.attackerLabel ?? CHAR_LABELS[opp.attacker]}) 🎲 ${aT.roll}/${aT.target} (DR ${aT.sl}) vs ${c.name} (${skillLabel}) 🎲 ${t.roll}/${t.target} (DR ${t.sl}) — ${defenderResists ? 'résiste' : 'l’emporte'}.`,
    ], c.id);
    const lines = applyTriggeredTestBranch(c, { success: defenderResists, sl: t.sl }, { onSuccess: node.success, onFail: node.fail });
    syncCombatant(ctx.get, ctx.set);
    queueLines(ctx.get, ctx.set, lines, c.id);
    playAfter(ctx.get, ctx.set, c, after, ctx.label);
    return;
  }
  queueLines(ctx.get, ctx.set, [describeTestRoll(c.name, skillLabel, difficulty, t)], c.id);
  const lines = applyTriggeredTestBranch(c, t, { onSuccess: node.success, onFail: node.fail });
  syncCombatant(ctx.get, ctx.set); // les combattants ont muté (États retirés)
  queueLines(ctx.get, ctx.set, lines, c.id);
  playAfter(ctx.get, ctx.set, c, after, ctx.label); // continuation APRÈS la branche (ordre du journal)
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredTest` — UN applier pour TOUTE mécanique (zéro applier par
 * talent). Lit `step.result` (succès/DR posés par `FLOWS.cascade`) + les Flows `meta.onSuccess/onFail`
 * (sérialisables) et exécute la MÊME conséquence partagée `applyTriggeredTestBranch`, PUIS la
 * continuation `meta.after` (l'`ExecCtx` est RECONSTRUIT depuis get()/hero — jamais capturé).
 */
registerCascadeApplier('triggeredTest', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const onSuccess = step.meta?.onSuccess;
  const onFail = step.meta?.onFail;
  if (!onSuccess || !onFail) return;
  const journal = applyTriggeredTestBranch(hero, step.result, { onSuccess, onFail });
  syncCombatant(get, set); // refléter la mutation du héros (États) dans party/battle
  // Continuation `after` (le reste du `seq` qui suivait le `test`) — peut ré-appender une étape
  // `triggeredTest` à la MÊME cascade (commitStep `liveMerge` repart des participants courants).
  playAfter(get, set, hero, step.meta?.after, step.label ?? 'Effet');
  return { journal };
});

/**
 * ROUTEUR d'un Flow de trigger PORTANT un nœud `test` vers la voie cadence-aware — installé dans
 * `triggeredEffects` (inversion de dépendance) par le STORE au runtime (`createCombatSlice`, comme le
 * hook `onGainCondition`), PAS au top-level de ce module : l'injecteur `setTriggeredTestRouter` vit en
 * amont d'un cycle d'imports (`triggeredEffects`→`combatEffects`→…→`combatFlow`→ce module) → l'appeler à
 * l'init donnerait une TDZ. Délègue au `runCombatFlow` à PILE (after-aware) : un `test` top-level
 * (Mâchoires, `onGainCondition`) est traité IDENTIQUEMENT au Lot 0 (`after` = pile vide) ; un `test`
 * ENFOUI (Venin sous `if`, Hurlement dans un `seq`) suspend en empaquetant le reste de la pile dans
 * `after`. Le `caster`/référent = `actor` (le porteur de l'effet : Force de la source pour les formules) ;
 * `target` = la cible de l'effet (qui jette le Test). `opsCtx` porte le contexte de la touche
 * (`woundsDealt`/`sl`/`location`/`attackKind`) lu par les Conditions `if` du Flow (Venin sur PB perdus).
 */
export function routeTriggeredTest(get: Get, set: SetFn, target: Combatant, actor: Combatant, flow: Flow, opsCtx?: OpsCtx): void {
  runCombatFlow({ mode: 'combat', get, set, target, caster: actor, label: opsCtx?.label ?? 'Effet', opsCtx }, flow);
}

/** Combattants en cours de notification `onGainCondition` — garde ANTI-RÉCURSION : un `onSuccess` qui
 *  ajoute un État (« tous Sonné retirés → Exténué ») ne doit pas re-déclencher le hook sur le même
 *  combattant en boucle. `WeakSet` (jamais sérialisé — pure mécanique de réentrance). */
const notifying = new WeakSet<Combatant>();

/**
 * Hook `onGainCondition` rempli par le store (`setConditionGainedHook`) : quand un combattant gagne un
 * État EN COMBAT, déclenche ses effets `onGainCondition` (Mâchoires d'acier). Gardes : combat actif +
 * combattant DANS la file de combat (pas un membre du groupe hors combat) + anti-récursion. Un Test
 * routé suspend (cascade) ou résout inline (la brique gère le journal) ; d'éventuelles lignes
 * NON-Test (futurs effets) sont mises dans la file de journal différée (§5).
 */
export function handleConditionGained(get: Get, set: SetFn, c: Combatant, name: string): void {
  const battle = get().battle;
  if (!battle || !battle.combatants.some((x) => x.id === c.id)) return; // hors combat / non-combattant → silence
  if (notifying.has(c)) return; // réentrance (un onSuccess ajoute un État) → on ne re-fire pas
  notifying.add(c);
  try {
    const lines = fireTriggers(get, c, 'onGainCondition', { conditionName: name, rng: battleRng(), set });
    if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: c.id }))] });
  } finally {
    notifying.delete(c);
  }
}
