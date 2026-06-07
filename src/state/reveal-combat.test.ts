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

  // Intégration avec la Déviation Critique (feature session //) : un Critique sur un héros ARMÉ
  // suspend pour le choix Dévier/Subir AVANT de révéler ; « Subir » applique → révèle ; « Dévier » non.
  it('Déviation Critique → « Subir » révèle le Coup Critique ; « Dévier » ne le révèle pas', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    hero.armour.corps = 3; // PA au corps → la déviation est possible
    const res = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;

    // (1) Le Critique sur le héros armé SUSPEND (pas de révélation encore).
    useGame.setState({ pendingReveals: [], pendingDeviation: null });
    const suspended = applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    expect(suspended).toBe(true);
    expect(useGame.getState().pendingDeviation).toBeTruthy();
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy();

    // (2) « Subir » (deviate=false) applique le Critique → la révélation est poussée.
    useGame.getState().deviationApply(false);
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeTruthy();

    // (3) « Dévier » (deviate=true) ignore le Critique → aucune révélation.
    hero.wounds = { current: 20, max: 20, base: 20 } as never;
    useGame.setState({ pendingReveals: [], pendingDeviation: null });
    applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    useGame.getState().deviationApply(true);
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy();
  });
});
