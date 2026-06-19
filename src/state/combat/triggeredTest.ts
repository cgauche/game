/**
 * BRIQUE « aucun jet de héros en silence » — exécuteur de Test cadence-aware d'un effet DÉCLENCHÉ.
 *
 * Module FEUILLE (chargé par effet de bord depuis combatFlow, qui le `export *`) : il n'importe RIEN
 * de combatFlow. Il REJOINT la voie unifiée existante (`pushCombatStep` → cascade `purpose:'combat'`
 * influençable + `registerCascadeApplier` + `runSpellFlow`) au lieu d'inventer un système.
 *
 * Un trigger dont le Flow est un nœud `test` (Mâchoires d'acier : « Test de Résistance pour ignorer
 * un État Sonné ») se résout selon la CADENCE de l'acteur :
 *  - héros en cadence MANUELLE → `pushCombatStep` d'une étape `kind:'triggeredTest'` INFLUENÇABLE
 *    (Chance/Pacte/Résilience), suspendue dans la cascade de combat — JAMAIS un `set(battle.log)`
 *    depuis ce hook profond (la branche héros ne touche QUE `pendingCascade`) ;
 *  - ennemi OU héros rapide/auto → jet INLINE (`rollTest`) + conséquence appliquée tout de suite,
 *    lignes poussées dans la file de journal partagée (`pendingLogQueue`, déversée au rendu).
 * Les DEUX branches partagent UNE conséquence : `applyTriggeredTestBranch` (le Flow `onSuccess`/`onFail`
 * via `runSpellFlow`, avec `ctx.sl = t.sl` pour les échelles `valuePerSL`).
 */
import { rollTest, type TestResult } from '../../engine/tests';
import { combatTestPenalty } from '../../engine/conditions';
import { testValue } from '../../engine/skills';
import { DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../../engine/types';
import type { Combatant, Difficulty } from '../../engine/types';
import { refLabel } from '../../data';
import type { Flow } from '../flow';
import type { Get, Set as SetFn } from '../flowTypes';
import { battleRng } from '../battleRng';
import { runSpellFlow, pushCombatStep } from '../combatEffects';
import { registerCascadeApplier } from '../cascade';
import { fireTriggers } from '../triggeredEffects';
import { roundTestInteractive } from './roundHooks';

/** Reflète la mutation EN PLACE d'un combattant (États retirés) dans les références party/battle pour
 *  un re-rendu React (clone des tableaux) — mirroir de `syncCombatant` des appliers d'upkeep. */
function syncCombatant(get: Get, set: SetFn): void {
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
}

/** Spécification d'un Test cadence-aware : la valeur brute + la difficulté + l'habillage de modale,
 *  et les DEUX branches (Flows) — la conséquence est portée par la DONNÉE, pas par du code. */
export interface CadenceTestSpec {
  base: number;
  difficulty: Difficulty;
  rollLabel: string;
  icon?: string;
  label: string;
  onSuccess: Flow;
  onFail: Flow;
}

/** Conséquence PARTAGÉE des deux branches (héros cascade ⇄ ennemi/auto inline) : exécute le Flow
 *  `onSuccess`/`onFail` via `runSpellFlow` sur `c` (référent = lui-même), `ctx.sl = t.sl` alimentant
 *  les échelles `valuePerSL` (« chaque DR supprime un État Sonné supplémentaire »). Renvoie le journal. */
export function applyTriggeredTestBranch(
  c: Combatant, t: Pick<TestResult, 'success' | 'sl'>, branches: { onSuccess: Flow; onFail: Flow },
): string[] {
  return runSpellFlow(c, c, t.success ? branches.onSuccess : branches.onFail, { rng: battleRng(), caster: c, sl: t.sl });
}

/**
 * Résout un Test d'effet déclenché de `c` selon sa cadence. Héros MANUEL → étape de cascade
 * influençable (suspend) ; sinon → jet inline + conséquence immédiate (lignes → `pendingLogQueue`).
 * `target` replié comme `poisonResist` (base + difficulté + pénalité d'État RAW).
 */
export function resolveCadenceTest(get: Get, set: SetFn, c: Combatant, spec: CadenceTestSpec): void {
  const penalty = combatTestPenalty(c);
  if (roundTestInteractive(c)) {
    // Héros en cadence manuelle : étape INFLUENÇABLE (Chance/Pacte/Résilience). On ne touche QUE
    // `pendingCascade` (jamais `battle.log`) → aucune collision avec le `set(battle.log)` de l'attaque.
    pushCombatStep(set, {
      id: `triggeredTest-${c.id}-${spec.rollLabel}`,
      kind: 'triggeredTest', actorId: c.id, icon: spec.icon, rollLabel: spec.rollLabel,
      base: spec.base, target: spec.base + DIFFICULTY_MODIFIERS[spec.difficulty] + penalty, label: spec.label,
      meta: { onSuccess: spec.onSuccess, onFail: spec.onFail },
    });
    return;
  }
  // Ennemi OU héros rapide/auto : jet silencieux + conséquence immédiate ; lignes différées (le hook
  // fire PLUS HAUT que le `set(battle.log)` final → on passe par la file, déversée au rendu, §5).
  const t = rollTest(spec.base, spec.difficulty, battleRng(), penalty);
  const lines = applyTriggeredTestBranch(c, t, { onSuccess: spec.onSuccess, onFail: spec.onFail });
  syncCombatant(get, set); // les combattants ont muté (États retirés)
  if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: c.id }))] });
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredTest` — UN applier pour TOUTE mécanique (zéro applier par
 * talent). Lit `step.result` (succès/DR posés par `FLOWS.cascade`) + les Flows `meta.onSuccess/onFail`
 * (sérialisables, voyagent en coop) et exécute la MÊME conséquence partagée `applyTriggeredTestBranch`.
 */
registerCascadeApplier('triggeredTest', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const onSuccess = step.meta?.onSuccess;
  const onFail = step.meta?.onFail;
  if (!onSuccess || !onFail) return;
  const journal = applyTriggeredTestBranch(hero, step.result, { onSuccess, onFail });
  syncCombatant(get, set); // refléter la mutation du héros (États) dans party/battle
  return { journal };
});

/**
 * ROUTEUR d'un Test de trigger vers la voie cadence-aware — installé dans `triggeredEffects` (inversion
 * de dépendance) par le STORE au runtime (`createCombatSlice`, comme le hook `onGainCondition`), PAS au
 * top-level de ce module : l'injecteur `setTriggeredTestRouter` vit en amont d'un cycle d'imports
 * (`triggeredEffects`→`combatEffects`→…→`combatFlow`→ce module) → l'appeler à l'init donnerait une TDZ.
 * Convertit un nœud Flow `test` en `CadenceTestSpec` : `base` = valeur de la Compétence/Caractéristique ;
 * `rollLabel`/`label` dérivés du nœud. Cible = `target` (qui a gagné l'État ; `on:'self'` ⇒ = porteur).
 */
export function routeTriggeredTest(get: Get, set: SetFn, target: Combatant, _actor: Combatant, node: Extract<Flow, { kind: 'test' }>): void {
  const ft = node.test;
  const base = testValue(target, ft.skill, ft.characteristic, ft.spec);
  const difficulty: Difficulty = ft.difficulty ?? 'intermediaire';
  const skillLabel = ft.skill ? refLabel('skills', { id: ft.skill, spec: ft.spec }) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  resolveCadenceTest(get, set, target, {
    base, difficulty, rollLabel: skillLabel, icon: '🎲', label: ft.label ?? skillLabel,
    onSuccess: node.success, onFail: node.fail,
  });
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
