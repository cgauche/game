import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import type { AttackResult } from '../engine/combat';

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('Frénésie du héros — attaque de CC GRATUITE chaque Round (LDB 21 l.34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
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
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    return { H, E };
  }

  it('1re attaque du Round = gratuite (Action préservée) + frenzyFreeUsed', () => {
    const { H, E } = setup();
    H.frenzied = true;
    H.frenzyFreeUsed = false;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    const st = useGame.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.frenzyFreeUsed).toBe(true);
    expect(st.battle!.acted).toBe(false); // l'Action n'est PAS consommée par l'attaque libre
  });

  it('2e attaque du même Round (gratuite déjà utilisée) → consomme l’Action', () => {
    const { H, E } = setup();
    H.frenzied = true;
    H.frenzyFreeUsed = true; // déjà utilisée ce Round
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('héros NON frénétique → l’attaque consomme l’Action', () => {
    const { H, E } = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('attaque libre de Frénésie INITIABLE même Action dépensée (entrée en Frénésie ce tour)', () => {
    const { H, E } = setup();
    H.frenzied = true;
    H.frenzyFreeUsed = false;
    const b = useGame.getState().battle!;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: 'attack', acted: true } }); // Action déjà dépensée (Test de FM d'entrée)
    useGame.getState().battleClickEntity(E.id);
    expect(useGame.getState().pendingAttack).not.toBeNull(); // l'attaque libre s'ouvre malgré `acted`
  });
});
