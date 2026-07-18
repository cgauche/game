/**
 * EXÉCUTEUR DE FLOW cadence-aware « aucun jet de héros en silence » — résout un nœud `test` d'un Flow
 * selon le CONTEXTE (scène / combat × cadence) et reprend la CONTINUATION `after` (le reste du `seq`).
 *
 * Module FEUILLE (chargé par effet de bord depuis combatFlow, qui le `export *`) : il n'importe RIEN
 * de combatFlow. Il REJOINT la voie unifiée existante (`pushCombatStep` → cascade `purpose:'combat'`
 * influençable + `registerCascadeApplier` + `runPureFlowLines`) au lieu d'inventer un système.
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
import { testValue, rawCombatTestBase } from '../../engine/skills';
import { describeTestRoll, type OpsCtx } from '../../engine/ops';
import { DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../../engine/types';
import type { Combatant, Difficulty } from '../../engine/types';
import { refLabel } from '../../data';
import { type Flow, type FlowTest, type ConditionCtx, evalCondition, conditionCtx, flowHasImpureOp, resolveTestDifficulty, EMPTY_FLOW } from '../flow';
import { buildActorView, combatConditionCtx, flowTestGated } from './flowEval';
import type { Get, Set as SetFn } from '../flowTypes';
import type { FreeAttackFreeze, BladeTrapFreeze, CascadeStep } from '../pendings';
import { battleRng } from '../battleRng';
import { runPureFlowLines, runFlow, pushCombatStep, openSkillTest, applyLeafOps, drainPendingLog } from '../combatEffects';
import { registerCascadeApplier } from '../cascade';
import { freeCons } from '../rollSeam';
import { recoveryGeometry, effectSourcesOf, fireOwnTestFailed } from '../triggeredEffects';
import { emitCombatEvent } from '../combatEvents';
import { humanControlled } from '../netOwnership';
import { inBattleId, actorIn } from '../combatOrParty';
import { campSpend } from './advantagePool';

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
  /** Contexte d'une ATTAQUE GRATUITE de talent (op `grantFreeAttack`) : la CIBLE de la frappe (un TIERS —
   *  le chargeur pour Frappe réactive `onCharged`, la victime touchée pour Assaut féroce `onHit` — distinct
   *  de `target`/`caster` qui sont le porteur), + le plafond /Round (`cap` = niveau du talent) et la `key`
   *  d'imputation (`freeAttacksThisTurn`). Threadé par `resolveFreeAttacks` ; le hook `freeAttack`
   *  (couche combatFlow) l'emploie quand `runCombatFlow` rencontre un `do` portant `grantFreeAttack`. Tout
   *  est sérialisable (ids/nombres) → mirroir dans `meta.freeAttack` pour la voie cascade (héros manuel). */
  freeAttack?: FreeAttackFreeze;
  /** Contexte de la CONSÉQUENCE d'un Test opposé de Piège-lame GAGNÉ (op `breakBlade`) : l'attaquant désarmé,
   *  la lame visée, le bonus de DR de la défense et le DR figé de l'attaquant — le hook `bladeTrap` (couche
   *  combatFlow) l'emploie quand `runCombatFlow` rencontre un `do` portant `breakBlade`. Tout est sérialisable
   *  (ids/nombres) → mirroir dans `meta.bladeTrap` pour la voie cascade (héros manuel). */
  bladeTrap?: BladeTrapFreeze;
}

/** HOOK de résolution d'une ATTAQUE GRATUITE (`grantFreeAttack`, op IMPURE) — injecté par le store
 *  (`setFreeAttackHook` dans `createCombatSlice`), pointe sur `applyTalentFreeAttack` (combatFlow). Appelé
 *  par `runCombatFlow` lorsqu'un `do`/`ops` porte un `grantFreeAttack` : il ouvre la VRAIE frappe (motif
 *  aiAvailableFreeAttack — instantanée, Action préservée). Inversion de dépendance (cette brique reste sans import
 *  de combatFlow → pas de cycle). Absent (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`). */
type FreeAttackHook = (
  get: Get, set: SetFn, actor: Combatant, op: Extract<import('../../engine/ops').GameOp, { op: 'grantFreeAttack' }>,
  fa: FreeAttackFreeze,
) => void;
let freeAttackHook: FreeAttackHook | undefined;
export function setFreeAttackHook(fn: FreeAttackHook): void { freeAttackHook = fn; }

/** HOOK de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (op `interruptFocus`, IMPURE)
 *  — injecté par le store (`setFocusInterruptHook` dans `createCombatSlice`), pointe sur
 *  `applyFocusInterruption` (combatFlow). Appelé par `runCombatFlow` lorsqu'un `do`/`ops` porte un
 *  `interruptFocus` : la cible perd ses DR focalisés (couverts par son composant) + subit une Imparfaite
 *  Mineure (LDB 46 l.144). Inversion de dépendance (cette brique reste sans import de combatFlow → pas de
 *  cycle). Absent (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`). */
type FocusInterruptHook = (get: Get, set: SetFn, focuser: Combatant) => void;
let focusInterruptHook: FocusInterruptHook | undefined;
export function setFocusInterruptHook(fn: FocusInterruptHook): void { focusInterruptHook = fn; }

/** HOOK de la branche de VICTOIRE d'un Test opposé de Piège-lame (op `breakBlade`, IMPURE) — injecté par le
 *  store (`setBladeTrapHook` dans `createCombatSlice`), pointe sur `applyBladeTrap` (combatFlow). Appelé par
 *  `runCombatFlow` lorsqu'un `do`/`ops` porte un `breakBlade` : l'attaquant ciblé (`bt.attackerId`) est
 *  désarmé de la lame `bt.weaponUid` ; marge nette `(DR défenseur + bt.defSL) − bt.attackerSL` ≥ 6 → lame
 *  BRISÉE sauf Incassable (LDB 62 l.295). Le DR du défenseur vient du Test résolu (`defSL` ci-dessous = celui
 *  du jet). Inversion de dépendance (cette brique reste sans import de combatFlow → pas de cycle). Absent
 *  (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`). */
type BladeTrapHook = (get: Get, set: SetFn, defender: Combatant, bt: BladeTrapFreeze, defenderSL: number) => void;
let bladeTrapHook: BladeTrapHook | undefined;
export function setBladeTrapHook(fn: BladeTrapHook): void { bladeTrapHook = fn; }

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
    location: o.location, woundsDealt: o.woundsDealt, engagedAdvantageGap: o.engagedAdvantageGap, attackKind: o.attackKind, startleCause: o.startleCause,
    foeInLoS: o.foeInLoS, hiddenFromFoes: o.hiddenFromFoes, engaged: o.engaged, nearestFoeDist: o.nearestFoeDist,
    target: buildActorView(ctx.target), caster: buildActorView(ctx.caster),
  };
}

/** Conséquence PARTAGÉE des deux branches (héros cascade ⇄ ennemi/auto inline) : exécute la branche
 *  `onSuccess`/`onFail` sur `c` (référent = lui-même), `ctx.sl = t.sl` alimentant les échelles `valuePerSL`
 *  (« chaque DR supprime un État Sonné supplémentaire »). Renvoie le journal de la BRANCHE (string[] tissé
 *  au bon canal : return cascade `{ journal }` / file inline).
 *  - Branche PURE (Mâchoires/Venin : feuilles `do`/`if`) → `runPureFlowLines` (string[] rendu inline).
 *  - Branche IMPURE (op adossée à un hook : `grantFreeAttack` → frappe gratuite, `interruptFocus` →
 *    interruption de Focalisation, `breakBlade` → désarmement/bris de Piège-lame) → `runCombatFlow` (le
 *    do-loop y résout les hooks injectés), qui EMPILENT leur propre conséquence (frappe / Imparfaite / étape
 *    d'affichage « lame brisée ») → return vide. Détectée par `flowHasImpureOp` (≠ « freeAttack présent » :
 *    tout marqueur à hook). Le contexte `exec` (get/set [+ freeAttack/bladeTrap pour cibler le TIERS]) est
 *    requis. La continuation `after` est jouée À PART (`playAfter`), APRÈS les lignes de branche → ordre correct. */
export function applyTriggeredTestBranch(
  c: Combatant, t: Pick<TestResult, 'success' | 'sl'>, branches: { onSuccess: Flow; onFail: Flow },
  exec?: { get: Get; set: SetFn; caster?: Combatant; freeAttack?: ExecCtx['freeAttack']; bladeTrap?: ExecCtx['bladeTrap'] },
): string[] {
  const branch = t.success ? branches.onSuccess : branches.onFail;
  // Référent des Formules (« votre Force Mentale » — Forêt d'épines LDB 48 l.749) : le LANCEUR d'origine
  // (`exec.caster`) quand il est connu et DIFFÈRE de `c` (zone de Sort posée par un tiers), sinon `c`
  // lui-même (Mâchoires/Contrôle de la Frénésie : effet auto-porté, comportement inchangé).
  const caster = exec?.caster ?? c;
  if (exec && flowHasImpureOp(branch)) {
    runCombatFlow({ mode: 'combat', get: exec.get, set: exec.set, target: c, caster, label: 'Effet', opsCtx: { sl: t.sl }, ...(exec.freeAttack ? { freeAttack: exec.freeAttack } : {}), ...(exec.bladeTrap ? { bladeTrap: exec.bladeTrap } : {}) }, branch);
    return [];
  }
  return runPureFlowLines(c, caster, branch, { rng: battleRng(), caster, sl: t.sl });
}

/** SOURCE UNIQUE du squelette d'étape `triggeredTest` d'un Test SIMPLE (non opposé) : convention RAW-correcte
 *  `base` BRUT (`rawCombatTestBase`, sans pénalité d'État) + `combatTestPenalty` UNE seule fois (LDB 16).
 *  Partagée par la voie « push » (`resolveFlowTest`, héros manuel mid-cascade) ET le collecteur de fin de
 *  Round (`collectHeroRoundEndUpkeep` : récupération d'États) → héros et ennemi récupèrent à l'identique.
 *  `extraMeta` porte le contexte sérialisable d'une réaction (Frappe réactive `freeAttack`, Piège-lame
 *  `bladeTrap`) ; absent pour une récupération. */
export function simpleTriggeredTestStep(
  c: Combatant, ft: FlowTest, branches: { onSuccess: Flow; onFail: Flow }, after: Flow, difficulty: Difficulty, extraMeta: Record<string, unknown> = {},
): CascadeStep {
  const base = rawCombatTestBase(c, ft.skill, ft.characteristic, ft.spec);
  const skillLabel = ft.skill ? refLabel('skills', { id: ft.skill, spec: ft.spec }) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  return {
    id: `triggeredTest-${c.id}-${skillLabel}`,
    kind: 'triggeredTest', actorId: c.id, icon: 'nav/dice', rollLabel: skillLabel,
    base, target: base + DIFFICULTY_MODIFIERS[difficulty] + combatTestPenalty(c), label: ft.label ?? skillLabel,
    meta: { onSuccess: branches.onSuccess, onFail: branches.onFail, after, ...extraMeta },
    // Tag de DONNÉE (`FlowTest.menace` — Venin/lames empoisonnées : 'Poison') → l'étape offre
    // l'auto-succès du talent Résistance (Menace) (LDB 10, verbe `cascadeResist`).
    ...(ft.menace ? { menace: ft.menace } : {}),
  };
}

/** Étapes de cascade des Tests de FIN DE ROUND en DONNÉES pour un héros MANUEL — pour chaque SOURCE
 *  d'effets déclenchés (États : récupération d'Empoisonné/Brisé LDB 16 ; TALENTS : Contrôle de la
 *  Frénésie LDB 10 ; Traits/psy demain) dont un `effects: onRoundEnd` porte un nœud `test`, une étape
 *  INFLUENÇABLE bâtie depuis la MÊME donnée (`simpleTriggeredTestStep`) que la voie inline (ennemi/auto)
 *  et la voie hors-combat. GÉNÉRIQUE (aucune entité nommée). Un effet OPT-IN (`optional`, RAW « Vous
 *  pouvez… ») devient une étape de CHOIX `triggeredChoice` (Oui → le Test est poussé par l'applier ;
 *  Renoncer par défaut), émise APRÈS les Tests obligatoires (du plus mécanique au plus optionnel).
 *  `after` vide : un Test de fin de Round est top-level. Jumeau du dispatcher (`effectSourcesOf` —
 *  MÊME énumération que `fireTriggers`, qui a lui SAUTÉ ces héros via `deferInteractiveTest`). */
export function collectRoundEndTestSteps(get: Get, c: Combatant): CascadeStep[] {
  const steps: CascadeStep[] = [];
  const optional: CascadeStep[] = [];
  // `ConditionCtx` de combat (géométrie d'arène : caché/Engagé/proximité du Brisé) — MÊME géométrie que
  // celle injectée par le dispatcher dans la voie inline, pour évaluer GATE et difficulté DYNAMIQUE.
  const cc = combatConditionCtx(c, { caster: c, ...recoveryGeometry(get, c) });
  for (const src of effectSourcesOf(c)) {
    for (const eff of src.effects) {
      if (eff.trigger !== 'onRoundEnd' || eff.flow.kind !== 'test') continue;
      const ft = eff.flow.test;
      if (flowTestGated(ft, c, cc)) continue; // gate fermée (Brisé caché/Engagé ; pas en Frénésie) → pas d'étape
      if (eff.optional) {
        // « Vous pouvez… » : étape de CHOIX (applier générique `triggeredChoice`) — le Oui pousse le
        // Test influençable dans la MÊME cascade (runCombatFlow → resolveFlowTest, liveMerge).
        const prompt = ft.label ?? src.label;
        optional.push({
          id: `triggeredChoice-${c.id}-${prompt}`, kind: 'triggeredChoice', actorId: c.id,
          icon: 'ui/think', label: prompt,
          options: [{ key: 'yes', label: prompt }, { key: 'no', label: 'Renoncer' }],
          defaultChoice: 'no', interactive: true,
          meta: { choiceYes: eff.flow, choiceNo: EMPTY_FLOW, after: EMPTY_FLOW },
        });
        continue;
      }
      steps.push(simpleTriggeredTestStep(c, ft, { onSuccess: eff.flow.success, onFail: eff.flow.fail }, EMPTY_FLOW, resolveTestDifficulty(ft, cc)));
    }
  }
  return [...steps, ...optional];
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
          if (unit) {
            // Ops IMPURES `grantFreeAttack` : résolues par le hook injecté (couche combatFlow) — la frappe
            // vise le TIERS de `ctx.freeAttack` (chargeur/victime), pas `unit` (le porteur). `applyOps` les
            // laisse inertes → on les passe quand même (no-op) pour garder le journal des autres ops.
            if (freeAttackHook && ctx.freeAttack) for (const op of node.effect.ops) if (op.op === 'grantFreeAttack') freeAttackHook(ctx.get, ctx.set, unit, op, ctx.freeAttack);
            // Op IMPURE `interruptFocus` (LDB 46 l.144) : le hook injecté (combatFlow) résout l'interruption
            // sur `unit` (le focaliseur) — perte des DR + Imparfaite Mineure (qui peut appender sa propre étape).
            if (focusInterruptHook) for (const op of node.effect.ops) if (op.op === 'interruptFocus') focusInterruptHook(ctx.get, ctx.set, unit);
            // Op IMPURE `breakBlade` (LDB 62 l.295) : le hook injecté (combatFlow) désarme/brise la lame de
            // l'attaquant ciblé (`ctx.bladeTrap`). `unit` = le défenseur piégeur ; son DR final (`ctx.opsCtx.sl`)
            // alimente la marge nette (= victoire Stupéfiante → bris). Le hook EMPILE sa conséquence comme étape
            // d'affichage propre (mirroir du Coup Critique) → rien à journaliser ici.
            if (bladeTrapHook && ctx.bladeTrap) for (const op of node.effect.ops) if (op.op === 'breakBlade') bladeTrapHook(ctx.get, ctx.set, unit, ctx.bladeTrap, ctx.opsCtx?.sl ?? 0);
            // `applyLeafOps` = SOURCE UNIQUE d'application d'une feuille : contexte de FEUILLE
            // (untilTime/label bakés — consommable) + programmation des ops IMPURES `delayed`.
            const lines = applyLeafOps(ctx.get, ctx.set, unit, node.effect, oc); syncCombatant(ctx.get, ctx.set); queueLines(ctx.get, ctx.set, lines, unit.id);
          }
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
      case 'choice': {
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        resolveFlowChoice(ctx, node, after);
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
  const cc = condCtxFor(ctx); // contexte d'évaluation (géométrie d'arène + ActorView) pour gate/difficultyBy
  // Gates op-level (immunité/groupes) + GATE générique de Condition (`gate`, Brisé : « pas Engagé OU Cœur
  // vaillant, ET pions restants ») — SOURCE UNIQUE partagée avec la voie inline (`resolveInlineFlowTest`).
  if (flowTestGated(ft, c, cc)) { playAfter(ctx.get, ctx.set, c, after, ctx.label); return; }
  const opp = ft.opposed;
  // Pénalité d'État comptée UNE seule fois (RAW : −10 d'Empoisonné/Sonné/… au Test, LDB 16, pas deux) :
  //  · Test SIMPLE → `base` BRUT (`rawCombatTestBase`, sans pénalité d'État) + `combatTestPenalty` (ci-dessous).
  //  · Test OPPOSÉ → `base` = `testValue` (porte déjà la pénalité d'État) + aucune pénalité ajoutée (penalty 0).
  const base = opp ? testValue(c, ft.skill, ft.characteristic, ft.spec) : rawCombatTestBase(c, ft.skill, ft.characteristic, ft.spec);
  const difficulty: Difficulty = resolveTestDifficulty(ft, cc); // dynamique (Brisé : caché/proche/loin), sinon ft.difficulty
  const skillLabel = ft.skill ? refLabel('skills', { id: ft.skill, spec: ft.spec }) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const label = ft.label ?? skillLabel;
  // Test SIMPLE : `combatTestPenalty` (sur le `base` BRUT → −10 d'État compté une fois). Test OPPOSÉ : 0
  // (l'op `opposedTest` jetait `testValue` brut des deux côtés ; `testValue` porte déjà la pénalité d'État).
  const penalty = opp ? 0 : combatTestPenalty(c);
  // Test OPPOSÉ : PRÉ-JET de l'attaquant (porteur), FIGÉ, AVANT le jet du défenseur — même ordre RNG que
  // `opposedTest()` (attaquant puis défenseur). Référent = `ctx.caster` (Force du porteur).
  const attacker = opp ? ctx.caster : undefined;
  // L'attaquant figé porte SON éventuel bonus de DR (Furtif sur la Discrétion de l'embusqueur, LDB 85)
  // baké dans `aT.sl` dès le pré-jet → la voie cascade (meta `aT`) ET la voie inline ré-opposent à l'identique.
  const aT: TestResult | undefined = opp && attacker
    ? (() => { const r = rollTest(testValue(attacker, opp.attackerSkill, opp.attacker), 'intermediaire', battleRng()); return { ...r, sl: r.sl + (opp.attackerBonusSL ?? 0) }; })()
    : undefined;
  // Piège-lame : on COMPLÈTE le freeze avec le DR de l'attaquant que CE Test jette (`aT`), pour que la
  // conséquence `breakBlade` recompose la marge nette sans re-jeter l'attaquant.
  const btFreeze = ctx.bladeTrap && aT ? { ...ctx.bladeTrap, attackerSL: aT.sl } : ctx.bladeTrap;
  if (humanControlled(ctx.get(), c)) {
    // Pilote humain en cadence manuelle : étape INFLUENÇABLE, suspendue dans la cascade. Branche + `after` (et,
    // pour une réaction, le contexte sérialisable `freeAttack`/`bladeTrap`) voyagent dans le meta → rejoués
    // par l'applier. Test OPPOSÉ : squelette construit ICI (base=`testValue`, penalty 0, + `aT` figé dans
    // le meta pour ré-opposer à chaque influence). Test SIMPLE : `simpleTriggeredTestStep` (source unique).
    // `noOwnTestFailed` : ce Test est LUI-MÊME un effet d'un `onOwnTestFailed` (FM de palier 2 des Crampes,
    // MSRC 16) — l'étampe empêche `commitStep` de ré-émettre le trigger à sa résolution (garde de ré-entrance
    // qui survit à la cadence asynchrone du héros).
    const extraMeta = { ...(ctx.caster && ctx.caster.id !== c.id ? { casterId: ctx.caster.id } : {}), ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}), ...(btFreeze ? { bladeTrap: btFreeze } : {}), ...(ctx.opsCtx?.noReentryOwnTestFailed ? { noOwnTestFailed: true } : {}) };
    pushCombatStep(ctx.set, aT && attacker
      ? {
          id: `triggeredTest-${c.id}-${skillLabel}`, kind: 'triggeredTest', actorId: c.id, icon: 'nav/dice', rollLabel: skillLabel,
          base, target: base + DIFFICULTY_MODIFIERS[difficulty] + penalty, label,
          meta: { onSuccess: node.success, onFail: node.fail, after, opposed: { aT, attackerId: attacker.id, attackerName: attacker.name, attackerLabel: opp!.attackerLabel ?? CHAR_LABELS[opp!.attacker], ...(opp!.bonusSL ? { bonusSL: opp!.bonusSL } : {}) }, ...extraMeta },
          ...(ft.menace ? { menace: ft.menace } : {}),
        }
      : simpleTriggeredTestStep(c, ft, { onSuccess: node.success, onFail: node.fail }, after, difficulty, extraMeta));
    return;
  }
  // `exec` (get/set [+ freeAttack/bladeTrap]) TOUJOURS fourni : une branche IMPURE (à hook : interruptFocus /
  // la success freeAttack / le breakBlade de Piège-lame) est routée vers `runCombatFlow` par
  // `applyTriggeredTestBranch` (cf. flowHasImpureOp) ; une branche PURE retombe sur `runPureFlowLines`
  // (inchangé). `freeAttack`/`bladeTrap` ne sont joints que s'ils existent.
  const exec = { get: ctx.get, set: ctx.set, ...(ctx.caster ? { caster: ctx.caster } : {}), ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}), ...(btFreeze ? { bladeTrap: btFreeze } : {}) };
  // Ennemi OU héros rapide/auto : jet INLINE + branche + continuation ; ligne de parité.
  // `skillLabel` = la Compétence/Caractéristique RÉELLE (cadre de jet), distincte du `label` de situation.
  const t = rollTest(base, difficulty, battleRng(), penalty);
  if (opp && aT && attacker) {
    // Test OPPOSÉ inline : l'attaquant figé (1ʳᵉ position) vs le jet du défenseur → le défenseur RÉSISTE
    // (success) si l'attaquant ne l'emporte PAS (défenseur vainqueur OU égalité). `t.success`/`t.sl` du
    // jet simple sont REMPLACÉS par l'issue opposée (LDB 62 l.268). Le bonus de DR du défenseur (Piège-lame,
    // LDB 62 l.295) s'AJOUTE à son `sl` AVANT l'opposition (modifie le vainqueur ET la marge nette).
    const bonusSL = opp.bonusSL ?? 0;
    const o = resolveOpposed(aT, { ...t, sl: t.sl + bonusSL });
    const defenderResists = o.winner !== 'attacker';
    // Chemin INLINE (défenseur non piloté par un humain — l.358) : ni l'attaquant ni le défenseur
    // n'ont de rangée `CascadeModal`/RollLine — le journal de combat est la SEULE surface des DEUX
    // jets de ce Test opposé, il les PORTE (#295 Lot 5, gardé nominativement).
    queueLines(ctx.get, ctx.set, [
      `${attacker.name} (${opp.attackerLabel ?? CHAR_LABELS[opp.attacker]}) ${aT.roll}/${aT.target} (DR ${aT.sl}) vs ${c.name} (${skillLabel}) ${t.roll}/${t.target} (DR ${t.sl}${bonusSL ? `+${bonusSL}` : ''}) — ${defenderResists ? 'résiste' : 'l’emporte'}.`,
    ], c.id);
    const lines = applyTriggeredTestBranch(c, { success: defenderResists, sl: t.sl }, { onSuccess: node.success, onFail: node.fail }, exec);
    // SEAM `onOwnTestFailed` (combat, jet inline ennemi/auto — Test OPPOSÉ perdu par le porteur).
    if (!defenderResists) lines.push(...fireOwnTestFailed(ctx.get, c, { sl: t.sl }));
    syncCombatant(ctx.get, ctx.set);
    queueLines(ctx.get, ctx.set, lines, c.id);
    playAfter(ctx.get, ctx.set, c, after, ctx.label);
    return;
  }
  queueLines(ctx.get, ctx.set, [describeTestRoll(c.name, skillLabel, difficulty, t)], c.id);
  const lines = applyTriggeredTestBranch(c, t, { onSuccess: node.success, onFail: node.fail }, exec);
  // SEAM `onOwnTestFailed` (combat, jet inline ennemi/auto — Test SIMPLE raté par le porteur).
  if (!t.success) lines.push(...fireOwnTestFailed(ctx.get, c, { sl: t.sl }));
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
  // `exec` (get/set) TOUJOURS fourni : une branche IMPURE à hook (interruptFocus / la success freeAttack /
  // le breakBlade de Piège-lame) est routée vers `runCombatFlow` par `applyTriggeredTestBranch` (cf.
  // flowHasImpureOp). `freeAttack` sérialisé (Frappe réactive) → joint pour cibler le TIERS (chargeur) ;
  // `bladeTrap` sérialisé → joint pour cibler la lame de l'attaquant ; absents → branche sur soi.
  const fa = step.meta?.freeAttack;
  const bt = step.meta?.bladeTrap;
  // Référent des Formules (`casterId`, cf. `CascadeStepMeta`) — combat OU groupe (`actorIn`, pas
  // `inBattleId` seul) : un lanceur qui a quitté la file de combat (fui/KO retiré) mais reste vivant
  // dans le groupe garde SON référent (Forêt d'épines LDB 48 l.749 : « qui utilise VOTRE Force
  // Mentale », pas celle du traverseur) ; absent/introuvable ⇒ `applyTriggeredTestBranch` retombe sur `hero`.
  const casterId = typeof step.meta?.casterId === 'string' ? step.meta.casterId : undefined;
  const caster = casterId ? actorIn(get(), casterId) : undefined;
  const exec = {
    get, set,
    ...(caster ? { caster } : {}),
    ...(fa && typeof fa === 'object' && 'targetId' in fa ? { freeAttack: fa } : {}),
    ...(bt && typeof bt === 'object' && 'attackerId' in bt ? { bladeTrap: bt } : {}),
  };
  const journal = applyTriggeredTestBranch(hero, step.result, { onSuccess, onFail }, exec);
  // (SEAM `onOwnTestFailed` d'une étape de cascade : centralisé dans `commitStep` — jamais ici, sinon
  //  double-émission ; l'étampe `meta.noOwnTestFailed` y garde la ré-entrance du FM de palier 2.)
  syncCombatant(get, set); // refléter la mutation du héros (États) dans party/battle
  // Continuation `after` (le reste du `seq` qui suivait le `test`) — peut ré-appender une étape
  // `triggeredTest` à la MÊME cascade (commitStep `liveMerge` repart des participants courants).
  playAfter(get, set, hero, step.meta?.after, step.label ?? 'Effet');
  return { consequences: freeCons(journal) };
});

/** Le coût d'Avantage d'un nœud `choice` est-il payable par le décideur ? (Coût absent ⇒ gratuit ⇒ oui.) */
function choiceAffordable(decider: Combatant | undefined, cost?: { advantage: number }): boolean {
  return !cost || (decider?.advantage ?? 0) >= cost.advantage;
}

/**
 * POINT DE DÉCISION d'un nœud `choice` (décision joueur opt-in) — FRÈRE de `resolveFlowTest`. Le DÉCIDEUR
 * est `ctx.caster` (le porteur de l'effet : Frappe réactive = le héros Chargé). `after` = continuation
 * reprise APRÈS la branche choisie.
 *  - HÉROS décideur en cadence MANUELLE → étape de CHOIX `triggeredChoice` dans la cascade de combat
 *    (`options` yes/no, `interactive`, `defaultChoice:'no'`) ; les Flows
 *    `yes`/`no`, le `cost`, l'`after` et le contexte `freeAttack` voyagent dans le `meta` (sérialisable).
 *    On ne touche QUE `pendingCascade`.
 *  - ENNEMI / cadence auto → décision AUTO inline : oui si le coût est payable (heuristique simple — l'IA
 *    saisit la réaction quand elle le peut), sinon non. La branche choisie est jouée par `runCombatFlow`
 *    (qui enchaîne sur le Test `yes` cadence-aware en aval), suivie de la continuation `after`.
 */
export function resolveFlowChoice(ctx: ExecCtx, node: Extract<Flow, { kind: 'choice' }>, after: Flow): void {
  const decider = ctx.caster ?? ctx.target;
  if (ctx.mode === 'combat' && decider && humanControlled(ctx.get(), decider)) {
    // Héros manuel : étape de CHOIX influençable (rendue par le chemin CHOIX générique de CascadeModal).
    // Le coût (en libellé) est joint au « Oui » ; l'option est tranchée par `cascadeChoose`.
    const yesLabel = node.cost ? `${node.prompt} (${node.cost.advantage} Av)` : node.prompt;
    // CIBLE de la branche : quand la branche vise une AUTRE unité que le décideur (`on:'victim'` —
    // Déstabilisante : le porteur décide, le Test opposé vise la VICTIME), on sérialise son id pour le
    // restaurer en `ctx.target` côté applier (sinon la branche viserait le décideur → Test sur soi-même).
    const branchTargetId = ctx.target && ctx.target.id !== decider.id ? ctx.target.id : undefined;
    pushCombatStep(ctx.set, {
      id: `triggeredChoice-${decider.id}-${node.prompt}`,
      kind: 'triggeredChoice', actorId: decider.id, icon: node.icon ?? 'ui/think', label: node.prompt,
      options: [{ key: 'yes', label: yesLabel }, { key: 'no', label: 'Renoncer' }],
      defaultChoice: 'no', interactive: true,
      meta: {
        choiceYes: node.yes, choiceNo: node.no ?? EMPTY_FLOW, after,
        ...(node.cost ? { choiceCost: node.cost.advantage } : {}),
        ...(branchTargetId ? { choiceTargetId: branchTargetId } : {}),
        ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}),
      },
    });
    return;
  }
  // Ennemi / héros rapide-auto : décision INLINE (oui si payable). Dépense le coût puis joue la branche.
  const yes = choiceAffordable(decider, node.cost);
  if (yes && node.cost && decider) campSpend(ctx.get, decider, node.cost.advantage); // débite la réserve du camp (mode groupe) / le combattant (LDB)
  runCombatFlow({ ...ctx }, yes ? node.yes : (node.no ?? EMPTY_FLOW));
  if (after !== EMPTY_FLOW) runCombatFlow({ ...ctx }, after);
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredChoice` — UN applier pour TOUTE décision opt-in (zéro applier par
 * mécanique). Reconstruit le décideur depuis get()/hero ; sur `chosen==='yes'` ET coût payable, dépense le
 * coût + joue la branche `yes` (via `runCombatFlow` — peut empiler une étape `triggeredTest` cadence-aware,
 * Frappe réactive) ; sinon joue `no`. Puis la continuation `after`. L'`ExecCtx` est RECONSTRUIT (jamais
 * capturé) ; le contexte `freeAttack` sérialisé rejoint l'exécution pour la frappe contre le tiers.
 */
registerCascadeApplier('triggeredChoice', (get, set, step, hero) => {
  if (!hero) return;
  const yes = step.chosen === 'yes';
  const cost = typeof step.meta?.choiceCost === 'number' ? step.meta.choiceCost : undefined;
  const yesFlow = step.meta?.choiceYes;
  const noFlow = step.meta?.choiceNo;
  const fa = step.meta?.freeAttack;
  const freeAttack = fa && typeof fa === 'object' && 'targetId' in fa ? fa : undefined;
  const can = yes && (cost == null || (hero.advantage ?? 0) >= cost);
  if (yes && can && cost != null) { campSpend(get, hero, cost); syncCombatant(get, set); } // débite la réserve du camp (mode groupe) / le combattant (LDB)
  // Le DÉCIDEUR (`hero`) est le `caster` (porteur). La branche vise `choiceTargetId` (la VICTIME, Déstabilisante)
  // si présent, sinon le décideur lui-même (Frappe réactive : Test sur soi). Reconstruit depuis get() — jamais capturé.
  const tid = typeof step.meta?.choiceTargetId === 'string' ? step.meta.choiceTargetId : undefined;
  const branchTarget = (tid ? inBattleId(get().battle, tid) : undefined) ?? hero;
  const ctx: ExecCtx = { mode: 'combat', get, set, target: branchTarget, caster: hero, label: step.label ?? 'Réaction', ...(freeAttack ? { freeAttack } : {}) };
  if (can) runCombatFlow(ctx, yesFlow ?? EMPTY_FLOW);
  else if (noFlow) runCombatFlow(ctx, noFlow);
  playAfter(get, set, hero, step.meta?.after, step.label ?? 'Réaction');
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
  // HORS COMBAT (Activité d'interlude — le FM de palier 2 des Crampes, MSRC 16 l.156) : un sous-Test d'un
  // HÉROS passe par la MODALE de jet CANONIQUE (`openSkillTest` → `pendingTest`, Chance/Résilience), jamais
  // inline (doctrine « un jet = une modale » — vaut aussi hors combat). Gate `slThreshold` évaluée d'abord
  // (openSkillTest ne la connaît pas) ; `noOwnTestFailed` tamponne la ré-entrance (resolveTest ne ré-émet pas).
  if (!get().battle && flow.kind === 'test' && target.kind === 'hero') {
    const cc = combatConditionCtx(target, opsCtx ?? {});
    if (flowTestGated(flow.test, target, cc)) return; // gate fermée → no-op (identique à la voie inline)
    openSkillTest(get, set, flow.test, flow.success, flow.fail, EMPTY_FLOW, { actorId: target.id, noOwnTestFailed: opsCtx?.noReentryOwnTestFailed });
    return;
  }
  runCombatFlow({ mode: 'combat', get, set, target, caster: actor, label: opsCtx?.label ?? 'Effet', opsCtx }, flow);
}

/** Implémentation du hook `setZoneCrossTestHook` (combatGeometry.ts, #500) — un `crossTest` de zone
 *  (Forêt d'épines, LDB 48 l.749) EST un `test` de Flow comme un autre : délègue à `routeTriggeredTest`,
 *  aucune machinerie propre. Injectée par le store (`createCombatSlice`), calque `freeAttackHookImpl`.
 *  `applyZoneCrossings` (l'appelant, combatGeometry.ts) n'a PAS accès à `drainPendingLog`
 *  (combatEffects.ts, cycle) : on draine ICI la voie INLINE (ennemi/auto — `resolveFlowTest` y pousse
 *  ses lignes dans `pendingLogQueue`, SOURCE UNIQUE) — no-op pour la voie cascade (héros manuel, aucune
 *  ligne encore produite au retour de `routeTriggeredTest`, elle en poussera à la résolution du jet). */
export function zoneCrossTestHookImpl(get: Get, set: SetFn, mover: Combatant, caster: Combatant, flow: Flow, label: string): void {
  routeTriggeredTest(get, set, mover, caster, flow, { label });
  const battle = get().battle;
  if (!battle) return;
  const drained = drainPendingLog(get, set);
  if (drained.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...drained] } });
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
    const lines: string[] = [];
    emitCombatEvent('onGainCondition', { get, set, battle, self: c, sink: (line) => lines.push(line), triggerCtx: { conditionName: name, rng: battleRng() } });
    if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: c.id }))] });
  } finally {
    notifying.delete(c);
  }
}
