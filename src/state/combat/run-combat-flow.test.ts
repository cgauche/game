import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runCombatFlow } from './triggeredTest';
import '../combatFlow'; // effet de bord : installe l'applier `triggeredTest` + le routeur + le hook onGainCondition
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { resetRule, setRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Flow } from '../flow';
import type { Combatant } from '../../engine/types';

/**
 * runCombatFlow — exécuteur à PILE d'un Flow EN COMBAT, cadence-aware, qui porte la CONTINUATION `after`.
 * Sur un nœud `test` ENFOUI dans un `seq` :
 *  - HÉROS manuel → pousse une étape de cascade `triggeredTest` (influençable) dont le `meta.after` est
 *    le reste du `seq` (le `do` qui suivait) ; `cascadeRoll`+`cascadeNext` joue la BRANCHE puis le `do`
 *    de continuation (preuve que `after` est repris) ;
 *  - ENNEMI → jet INLINE + branche + `after`, SANS étape de cascade.
 * Jumeau de `run-flow.test` (scène) et de `round-upkeep-cascade.test` (cascade).
 */
const wounds = (amount: number): Flow => ({ kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount }] } });

/** Flow `seq[ do(−pre PB), test{F → success/fail}, do(−post PB) ]` — le `do` final est la CONTINUATION
 *  `after` qui doit s'appliquer APRÈS la branche (jamais avalée par le test). */
function flow(pre: number, success: number, fail: number, post: number): Flow {
  return {
    kind: 'seq',
    steps: [
      wounds(pre),
      { kind: 'test', test: { characteristic: 'F', label: 'Force' }, success: wounds(success), fail: wounds(fail) },
      wounds(post), // CONTINUATION
    ],
  };
}

describe('runCombatFlow — test enfoui + continuation after (combat)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetRule('combat-cadence');
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 };
    // Beaucoup de PB pour que les pertes du Flow ne mettent personne hors de combat (pas d'À Terre à 0).
    H.wounds.max = 200; H.wounds.current = 200;
    E.wounds.max = 200; E.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingReveals: [], pendingLogQueue: [] });
    return { H, E };
  }

  const live = (id: string): Combatant => useGame.getState().battle!.combatants.find((x) => x.id === id)!;

  it('HÉROS manuel : test enfoui → étape triggeredTest (after = le do final, non avalé)', () => {
    seedBattleRng(7);
    const { H } = setup();
    const before = live(H.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux' }, flow(3, 5, 99, 7));

    // Le `do` AVANT le test est appliqué tout de suite ; le test suspend ; la continuation attend.
    expect(live(H.id).wounds.current).toBe(before - 3);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    const step = c.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();           // pas encore lancé → influençable
    expect(step.meta?.onSuccess).toBeTruthy();
    expect(step.meta?.after).toBeTruthy();      // la continuation voyage dans le meta (sérialisable)
  });

  it('HÉROS manuel : cascadeRoll+cascadeNext joue la BRANCHE puis la continuation (Force élevée → succès)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.F = 90; // Force élevée → Test réussi (branche success = −5)
    const before = live(H.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux' }, flow(3, 5, 99, 7));
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();

    // pre(3) + branche succès(5) + continuation after(7) = 15 ; l'échec(99) n'est PAS pris.
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
  });

  it('ENNEMI : test enfoui → INLINE (branche + after), aucune étape de cascade', () => {
    seedBattleRng(5);
    const { E } = setup();
    E.characteristics.F = 90; // Force élevée → succès inline (branche success = −5)
    const before = live(E.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: E, caster: E, label: 'Flux' }, flow(3, 5, 99, 7));

    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → jamais d'étape influençable
    // pre(3) + branche(5) + after(7) = 15, appliqués inline d'un coup.
    expect(live(E.id).wounds.current).toBe(before - (3 + 5 + 7));
    // La ligne de parité du Test (describeTestRoll) + les conséquences partent dans la file différée.
    expect(useGame.getState().pendingLogQueue.length).toBeGreaterThan(0);
  });

  it('HÉROS en cadence AUTO : test enfoui → INLINE comme un monstre (pas de cascade)', () => {
    setRule('combat-cadence', 'auto');
    try {
      seedBattleRng(5);
      const { H } = setup();
      H.characteristics.F = 90;
      const before = live(H.id).wounds.current;

      runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux' }, flow(3, 5, 99, 7));

      expect(useGame.getState().pendingCascade).toBeNull(); // auto → inline
      expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
    } finally {
      resetRule('combat-cadence');
    }
  });
});
