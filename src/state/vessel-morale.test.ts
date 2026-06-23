import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import { makePregens } from '../data/pregens';

/**
 * Navire de campagne PERSISTANT (MDG ch.14) : le Moral de l'équipage est recalculé une fois par SEMAINE
 * par l'entretien quotidien (`tickShipMorale`), avec la même garde anti-double-comptage que les rations.
 */
beforeEach(() => {
  useGame.setState({
    battle: null, mode: 'exploration', journal: [], travelPlan: null, pendingReveals: [],
    party: makePregens().slice(0, 1), gameTime: 0, lastUpkeepDay: 0, vessel: null,
  });
  seedBattleRng(7);
});

describe('Moral du navire de campagne — recalcul hebdomadaire dans l’entretien quotidien', () => {
  it('moins d’une semaine écoulée → Moral inchangé', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    useGame.getState().advanceTime(3 * MINUTES_PER_DAY);
    expect(useGame.getState().vessel!.morale.score).toBe(75);
    expect(useGame.getState().vessel!.morale.lastMoraleWeek).toBe(0);
  });

  it('franchissement de semaine → Moral recalculé (pas-de-paie −3d10) et journalisé', () => {
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] } } });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie » fait toujours chuter le Moral
    expect(useGame.getState().journal.join('\n')).toMatch(/Moral de l'équipage/);
  });

  it('sans navire (vessel null) → aucun effet, aucun plantage', () => {
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    expect(useGame.getState().vessel).toBeNull();
  });
});
