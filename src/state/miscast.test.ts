import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyMiscast } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

// Colère des dieux / Incantation Imparfaite — révélation témoin (« un jet = une modale »).
describe('Miscast en révélation (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingReveals: [], battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function battle() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return {
      hero: b.combatants.find((c) => c.kind === 'hero')!,
      enemy: b.combatants.find((c) => c.kind === 'enemy')!,
    };
  }

  it('une Colère des dieux d’un HÉROS pousse une révélation (dé + effets)', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingReveals: [] });
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const reveals = useGame.getState().pendingReveals;
    expect(reveals.length).toBe(1);
    expect(reveals[0].kind).toBe('miscast');
    expect(reveals[0].title).toBe('Colère des dieux');
    expect(typeof reveals[0].dice).toBe('number');
  });

  it('une Incantation Imparfaite Mineure d’un HÉROS pousse une révélation', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingReveals: [] });
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    expect(useGame.getState().pendingReveals[0]?.title).toBe('Incantation Imparfaite');
  });

  it('une Maladresse d’un ENNEMI ne pousse PAS de révélation (instantané)', () => {
    useGame.getState().seedRng(2);
    const { enemy } = battle();
    useGame.setState({ pendingReveals: [] });
    applyMiscast(useGame.getState, useGame.setState, enemy, 'colere');
    expect(useGame.getState().pendingReveals).toEqual([]);
  });
});
