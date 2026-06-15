/**
 * FLOW — la couche de LOGIQUE authorée du jeu : conditions → effets → branches, façon liste de
 * blocs imbriqués (RPG Maker / ink), pas de graphe à fils. UNE structure récursive, sérialisation
 * STABLE (c'est le contrat édité dans l'éditeur ET sauvegardé dans les scènes/sorts). Elle subsume,
 * à terme, `Effect[]` (la séquence), les branches `test`/dialogue, et les conditions de trigger —
 * source UNIQUE de la logique de contenu (triggers, dialogues, interactions, pièges, sorts custom).
 *
 * Discipline (briques stables, pas de DSL ouvert) :
 *  - ENSEMBLE CLOS de Conditions et de nœuds — la puissance vient de la COMPOSITION, pas de la
 *    croissance de l'ensemble. Ajouter un nœud « juste pour un sort » = échec.
 *  - PAS de boucle (arbre, jamais cyclique) : ni `while`, ni saut arrière → contenu raisonnable,
 *    pas de risque de boucle infinie.
 *  - Les Conditions sont PURES (lisent l'état, ne le mutent pas) ; les effets sont les feuilles `do`.
 *
 * Ce module porte le MODÈLE + l'évaluation PURE des Conditions (remplace `condMet` +
 * `temporalConditionMet`). L'EXÉCUTION interactive (ouvrir une modale de Test, suspendre, reprendre)
 * vit dans le store (`runFlow`, brique suivante) — comme `applyEffects` aujourd'hui.
 */
import type { Effect, TemporalCondition } from './scene';
import { condMet, temporalConditionMet } from './scene';
import type { CharKey, Difficulty } from '../engine/types';

/** Algèbre CLOSE de Conditions (sérialisation-stable). `flag`/`time` reprennent la sémantique des
 *  anciens `condMet`/`temporalConditionMet` ; `all`/`any` composent ; `not` nie. Aucune condition
 *  qui MUTE l'état — purement interrogative. */
export type Condition =
  | { kind: 'always' }
  /** ET de drapeaux avec négation : « v1,!v2 » ⇔ flags.v1 && !flags.v2 (sémantique `condMet`). */
  | { kind: 'flag'; expr: string }
  /** Fenêtre horaire (heure-du-jour, `before` exclusif) — sémantique `temporalConditionMet`. */
  | { kind: 'time'; window: TemporalCondition }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

/** Contexte d'évaluation d'une Condition (lecture seule). Étendu plus tard (stats de groupe,
 *  inventaire, lieu) — toujours un ensemble CLOS. */
export interface ConditionCtx {
  flags: Record<string, boolean>;
  gameTime: number;
}

/** Évalue une Condition — SOURCE UNIQUE (remplace `condMet`/`temporalConditionMet` à terme). PURE. */
export function evalCondition(cond: Condition, ctx: ConditionCtx): boolean {
  switch (cond.kind) {
    case 'always': return true;
    case 'flag': return condMet(cond.expr, ctx.flags);
    case 'time': return temporalConditionMet(cond.window, ctx.gameTime);
    case 'all': return cond.of.every((c) => evalCondition(c, ctx));
    case 'any': return cond.of.some((c) => evalCondition(c, ctx));
    case 'not': return !evalCondition(cond.of, ctx);
  }
}

/** Le Test d'un nœud `test` (jet de compétence/caractéristique différé → modale). Mêmes champs que
 *  l'`Effect` 'test' d'aujourd'hui, mais SANS les branches (portées par le nœud Flow). */
export interface FlowTest {
  skill?: string;
  characteristic?: CharKey;
  difficulty?: Difficulty;
  /** DR minimum requis (défaut 0 = simple réussite). */
  requireSL?: number;
  label?: string;
}

/**
 * Un nœud de Flow. Quatre formes, RÉCURSIVES, jamais cycliques :
 *  - `seq`  : exécute `steps` dans l'ordre (l'ancien `Effect[]`) ;
 *  - `do`   : une feuille — applique un `Effect` (action) ;
 *  - `if`   : évalue `cond` (PUR) → `then` / `else` ;
 *  - `test` : jet interactif → `success` / `fail` (l'ancien `Effect.test`, sorti d'`Effect`).
 */
export type Flow =
  | { kind: 'seq'; steps: Flow[] }
  | { kind: 'do'; effect: Effect }
  | { kind: 'if'; cond: Condition; then: Flow; else?: Flow }
  | { kind: 'test'; test: FlowTest; success: Flow; fail: Flow };

/** Flow vide (séquence sans étape) — neutre, sûr comme valeur par défaut d'un consommateur. */
export const EMPTY_FLOW: Flow = { kind: 'seq', steps: [] };

/** Enveloppe une liste d'`Effect` (ancien format) en un Flow `seq` de `do` — pont de migration des
 *  consommateurs (`Trigger.effects`, `DialogueChoice.effects`) vers le Flow, sans réécrire la donnée. */
export function flowFromEffects(effects: Effect[] | undefined): Flow {
  return { kind: 'seq', steps: (effects ?? []).map((effect) => ({ kind: 'do', effect })) };
}

/**
 * Aplatit un Flow SANS Test ni If non résolu en une liste d'`Effect` (les `if` sont évalués contre
 * `ctx`). Couvre `seq`/`do`/`if`. Un nœud `test` lève — son exécution est interactive (store). Utile
 * pour les consommateurs purement séquentiels et pour tester la résolution des branches `if`. */
export function flattenFlow(flow: Flow, ctx: ConditionCtx): Effect[] {
  switch (flow.kind) {
    case 'do': return [flow.effect];
    case 'seq': return flow.steps.flatMap((s) => flattenFlow(s, ctx));
    case 'if': {
      const branch = evalCondition(flow.cond, ctx) ? flow.then : flow.else;
      return branch ? flattenFlow(branch, ctx) : [];
    }
    case 'test':
      throw new Error('flattenFlow: un nœud `test` est interactif — utiliser runFlow (store).');
  }
}

/** Le Flow contient-il un nœud `test` (→ exécution interactive nécessaire, pas un simple aplatissage) ? */
export function flowHasTest(flow: Flow): boolean {
  switch (flow.kind) {
    case 'do': return false;
    case 'seq': return flow.steps.some(flowHasTest);
    case 'if': return flowHasTest(flow.then) || (flow.else ? flowHasTest(flow.else) : false);
    case 'test': return true;
  }
}
