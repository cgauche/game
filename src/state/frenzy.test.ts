import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolvePsychAI, endFrenzyIfDone } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import type { Combatant } from '../engine/types';

describe('Frénésie — immunité psy & fin (→ Exténué)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
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
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi en Frénésie est immunisé à la Terreur (pas de Brisé)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2
    E.frenzied = true;
    E.characteristics.FM = 10;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.name === 'Brisé')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });

  it('la Frénésie finit (Exténué) quand plus aucun ennemi n’est en Ligne de Vue', () => {
    const { H, E } = setup();
    E.frenzied = true;
    (H as Combatant).dead = true; // plus d'ennemi vivant pour E
    endFrenzyIfDone(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.frenzied).toBe(false);
    expect(e.conditions.some((c) => c.name === 'Exténué')).toBe(true);
  });
});
