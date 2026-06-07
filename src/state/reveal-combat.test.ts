import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import type { AttackResult } from '../engine/combat';

// Coup Critique / Assommante en révélation + gel de l'IA (« un jet = une modale »).
describe('Conséquences d’attaque en révélation (store)', () => {
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
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return { b, hero: b.combatants.find((c) => c.kind === 'hero')!, enemy: b.combatants.find((c) => c.kind === 'enemy')! };
  }

  it('un Coup Critique pousse une révélation « Coup Critique » (avec dé)', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    useGame.setState({ pendingReveals: [] });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], res);
    const crit = useGame.getState().pendingReveals.find((r) => r.kind === 'critical');
    expect(crit).toBeTruthy();
    expect(typeof crit!.dice).toBe('number');
  });

  it('l’avancement de tour est GELÉ tant qu’une révélation est en attente', () => {
    const { b, enemy } = battle();
    const turn = b.order.indexOf(enemy.id);
    useGame.setState({
      battle: { ...b, turn, acted: true },
      pendingReveals: [{ kind: 'critical', title: 'Coup Critique', dice: 50, lines: ['x'] }],
    });
    useGame.getState().battleEndTurn(); // → advanceTurn, gelé par la file
    expect(useGame.getState().battle!.turn).toBe(turn); // pas avancé
    useGame.getState().dismissReveal();
    expect(useGame.getState().pendingReveals).toEqual([]); // file vidée
  });
});
