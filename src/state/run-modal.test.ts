import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

describe('Course (Courir) — modale Test d’Athlétisme +20 (LDB 15 l.79-82)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingRun: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.pos = { x: 10, y: 10 };
    H.engagedWith = []; // pas Engagé → Course autorisée
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, acted: false, moved: false }, pendingRun: null });
    return { H };
  }

  it('battleRun ouvre pendingRun ; runRoll lance ; runConfirm étend le déplacement + consomme l’Action', () => {
    useGame.getState().seedRng(2);
    const { H } = setup();
    useGame.getState().battleRun();
    const pr = useGame.getState().pendingRun;
    expect(pr).toBeTruthy();
    expect(pr!.combatantId).toBe(H.id);
    expect(pr!.result).toBeNull();

    useGame.getState().runRoll();
    const r = useGame.getState().pendingRun!.result!;
    expect(r.bonusCases).toBeGreaterThan(0); // Course = 2×Mouvement + DR/2

    useGame.getState().runConfirm();
    const st = useGame.getState();
    expect(st.pendingRun).toBeNull();
    expect(st.battle!.acted).toBe(true); // l'Action est consommée par la Course
    expect(st.battle!.action).toBe('move');
    expect(st.battle!.reachable.size).toBeGreaterThan(0); // déplacement étendu ouvert
  });

  it('Engagé → battleRun n’ouvre rien (il faut se désengager d’abord)', () => {
    const { H } = setup();
    H.engagedWith = ['x'];
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    useGame.getState().battleRun();
    expect(useGame.getState().pendingRun).toBeNull();
  });

  it('Action déjà dépensée → battleRun n’ouvre rien', () => {
    setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battleRun();
    expect(useGame.getState().pendingRun).toBeNull();
  });
});
