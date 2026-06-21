/**
 * Setup global Vitest (`test.setupFiles`) — FILET D'ISOLATION DES TIMERS.
 *
 * Le combat planifie l'IA et l'enchaînement des tours via de VRAIS `setTimeout` (`combatFlow.ts` →
 * `advanceTurn`/`runEnemyAI`, délais `TEMPO` de `tempo.ts`) qui MUTENT `battle`. Un test qui arme
 * `vi.useFakeTimers()` sans le restaurer laisse des timers fantômes : un `setTimeout` planifié mais non
 * drainé se déclenche pendant un test ULTÉRIEUR et corrompt `battle.turn` → flake intermittent (le RNG
 * étant seedé, c'est 100 % ce timer résiduel, jamais le hasard).
 *
 * Ce hook GLOBAL garantit qu'AUCUN test (présent ET futur, sur les 419 fichiers) ne laisse de fake timer
 * actif. Il s'exécute APRÈS l'`afterEach` de chaque fichier (ordre Vitest : les hooks de setupFile sont
 * les plus EXTERNES) → no-op pour les fichiers déjà corrects (qui restaurent eux-mêmes), filet de
 * sécurité pour les autres. `vi.useRealTimers()` DÉSINSTALLE l'horloge factice et JETTE ses timers en
 * attente (le `setTimeout` fantôme de l'IA ne pourra plus se déclencher) ; appelé en mode réel, c'est un
 * no-op → ZÉRO risque (pas besoin de tester l'état, contrairement à `isFakeTimersInstalled` absent en v2.1).
 */
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
});
