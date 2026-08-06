// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { testScene } from '../../scenes/test-fixture';
import { useGame } from '../../state/store';
import { useHoverTargeting } from './useHoverTargeting';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const battle = useGame.getState().battle!;
  const active = battle.combatants.find((combatant) => combatant.kind === 'hero')!;
  active.pos = { x: 6, y: 10 };
  active.engagedWith = [];
  let enemyX = 20;
  for (const enemy of battle.combatants.filter((combatant) => combatant.kind === 'enemy')) {
    enemy.pos = { x: enemyX++, y: 20 };
  }
  useGame.setState({
    mode: 'battle',
    battle: { ...battle, turn: battle.order.indexOf(active.id), action: null, preview: null },
    pendingAttack: null,
    pendingDefense: null,
    pendingTrample: null,
    pendingHeal: null,
    pendingCast: null,
    pendingCleave: null,
    pendingDualStrike: null,
    hoverDelta: null,
    combatCursor: null,
    hoverCombatantId: null,
  });
  return active;
}

describe('useHoverTargeting — intention de déplacement', () => {
  beforeEach(() => useGame.setState({ battle: null, hoverDelta: null }));
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
  });

  it('publie la résolution canonique et son delta de ressources au survol', () => {
    const active = setup();
    const hover = { x: active.pos!.x + 2, y: active.pos!.y };
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(testScene, hover, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));

    expect(result?.hoverMove).toMatchObject({ kind: 'move', cost: 2 });
    expect(useGame.getState().hoverDelta).toMatchObject({
      action: 0,
      move: 2,
      adv: 0,
      movement: { status: 'ok', kind: 'move', cost: 2 },
    });
  });

  it('publie le refus du résolveur sans tracer de chemin', () => {
    const active = setup();
    active.engagedWith = ['enemy'];
    const hover = { x: active.pos!.x - 1, y: active.pos!.y };
    let result: ReturnType<typeof useHoverTargeting> | undefined;
    const Probe = () => {
      result = useHoverTargeting(testScene, hover, true);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));

    expect(result?.hoverMove).toBeNull();
    expect(useGame.getState().hoverDelta).toEqual({
      action: 0,
      move: 0,
      adv: 0,
      movement: { status: 'blocked', reason: 'engaged' },
    });
  });
});
