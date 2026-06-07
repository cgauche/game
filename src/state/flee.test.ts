import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

// Fuite (LDB 15-Dépl l.101-107) : coup dans le dos + Test de Calme → révélations témoins.
describe('Fuite en révélation (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], pendingDisengage: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('Fuir pousse le coup dans le dos puis (si touché) le Test de Calme en révélations', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    E.characteristics.CC = 90; // le coup dans le dos (+20) touche à coup sûr
    H.wounds = { current: 40, max: 40, base: 40 } as never;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    useGame.setState({
      battle: { ...b },
      pendingReveals: [],
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    useGame.getState().disengageFlee();

    const reveals = useGame.getState().pendingReveals;
    expect(reveals.map((r) => r.kind)).toEqual(['backstab', 'calme']); // coup dans le dos PUIS Calme
    expect(typeof reveals[0].dice).toBe('number');
    expect(useGame.getState().pendingDisengage).toBeNull();
  });
});
