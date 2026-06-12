import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
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
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
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

  // Déviation Critique fusionnée : le Critique est PRÉ-TIRÉ et affiché SUR la modale de déviation (choix
  // éclairé). « Subir » applique CE Critique sans 2ᵉ modale ; « Dévier » l'ignore (−1 PA).
  it('Déviation Critique → « Subir » applique le Critique montré (sans 2ᵉ modale) ; « Dévier » l’ignore', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    const heroNow = () => useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    hero.armour.corps = 3; // PA au corps → la déviation est possible
    const res = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;

    // (1) Le Critique sur le héros armé SUSPEND, en pré-affichant le Critique DANS la modale de déviation.
    useGame.setState({ pendingReveals: [], pendingDeviation: null });
    const suspended = applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    expect(suspended).toBe(true);
    const pdv = useGame.getState().pendingDeviation;
    expect(pdv).toBeTruthy();
    expect(pdv!.reveal.kind).toBe('critical'); // la révélation est portée par la modale de déviation
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy();

    // (2) « Subir » (deviate=false) applique CE Critique — sans pousser une 2ᵉ révélation.
    const cwBefore = heroNow().criticalWounds ?? 0;
    useGame.getState().deviationApply(false);
    expect(heroNow().criticalWounds ?? 0).toBeGreaterThan(cwBefore);
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy();

    // (3) « Dévier » (deviate=true) ignore le Critique → aucune Blessure critique, aucune révélation.
    const h = heroNow();
    h.wounds = { current: 20, max: 20, base: 20 } as never;
    h.criticalWounds = 0;
    useGame.setState({ pendingReveals: [], pendingDeviation: null });
    applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    useGame.getState().deviationApply(true);
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy();
    expect(heroNow().criticalWounds ?? 0).toBe(0); // pas de Blessure critique appliquée
  });
});
