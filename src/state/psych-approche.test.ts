import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

// Approche sous Peur (LDB 21 l.29) : on ne peut pas se rapprocher de la source de sa Peur.
describe('Approche sous Peur (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('un héros sous Peur ne peut pas avancer VERS la source, mais peut s’en éloigner', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 15, y: 10 };
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    const turn = b.order.indexOf(H.id);
    useGame.setState({
      battle: { ...b, turn, action: 'move', movementUsed: 0, reachable: new Map([['11,10', 1], ['9,10', 1]]) },
      pendingReveals: [],
    });

    // Vers la source (15,10) : 11,10 réduit la distance → refusé.
    useGame.getState().battleClickTile({ x: 11, y: 10 });
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });

    // S'éloigner (9,10) : autorisé.
    useGame.getState().battleClickTile({ x: 9, y: 10 });
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 9, y: 10 });
  });
});
