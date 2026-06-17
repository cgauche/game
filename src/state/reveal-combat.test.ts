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
    useGame.setState({ pendingReveals: [], pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function battle() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], pendingReveals: [] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return { b, hero: b.combatants.find((c) => c.kind === 'hero')!, enemy: b.combatants.find((c) => c.kind === 'enemy')! };
  }

  it('un Coup Critique ouvre une séquence de conséquence « Coup Critique » (panneau riche)', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], res);
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const crit = c?.participants.find((s) => s.kind === 'critical');
    expect(crit).toBeTruthy();
    expect(crit!.reveal?.kind).toBe('critical'); // charge riche → panneau CriticalBody inline
    expect(typeof crit!.reveal?.dice).toBe('number');
    expect(useGame.getState().pendingReveals.find((r) => r.kind === 'critical')).toBeFalsy(); // plus en file témoin
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

  // Déviation Critique FOLDÉE (P3a) : le Critique pré-tiré + le choix Dévier/Subir = une ÉTAPE de la
  // séquence (panneau riche). « Subir » applique CE Critique ; « Dévier » l'ignore (−1 PA).
  it('Déviation Critique → étape de CHOIX inline : « Subir » applique le Critique, « Dévier » l’ignore', () => {
    useGame.getState().seedRng(2);
    const { hero, enemy } = battle();
    const heroNow = () => useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    hero.armour.corps = 3; // PA au corps → la déviation est possible
    const devId = `cons-deviation-${hero.id}`;
    const res = {
      hit: true, attackerRoll: 33, netSL: 2, critical: true, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 3, location: 'corps', log: 'touche !',
    } as AttackResult;

    // (1) Le Critique sur le héros armé SUSPEND, en posant une ÉTAPE DE CHOIX (Critique pré-tiré + options).
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    const suspended = applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    expect(suspended).toBe(true);
    const dev = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'deviation');
    expect(dev?.reveal?.kind).toBe('critical'); // panneau riche porté par l'étape

    // (2) « Subir » applique CE Critique.
    const cwBefore = heroNow().criticalWounds ?? 0;
    useGame.getState().cascadeChoose(devId, 'subir');
    useGame.getState().cascadeNext();
    expect(heroNow().criticalWounds ?? 0).toBeGreaterThan(cwBefore);

    // (3) « Dévier » ignore le Critique → aucune Blessure critique.
    const h = heroNow();
    h.wounds = { current: 20, max: 20, base: 20 } as never;
    h.criticalWounds = 0;
    useGame.setState({ pendingReveals: [], pendingCascade: null });
    applyAttackResult(useGame.getState, useGame.setState, enemy, hero, enemy.weapons[0], res);
    useGame.getState().cascadeChoose(devId, 'devier');
    useGame.getState().cascadeNext();
    expect(heroNow().criticalWounds ?? 0).toBe(0); // pas de Blessure critique appliquée
  });
});
