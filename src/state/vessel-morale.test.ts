import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import { toBrass } from '../engine/money';
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

describe('Paie hebdomadaire de l’équipage salarié (MDG 14, #216) — couture à l’entretien', () => {
  it('bourse suffisante → solde prélevée + facteur paie-reguliere (+1d10), aucune dette', () => {
    useGame.setState({
      money: { gold: 10, silver: 0, brass: 0 }, // Mousse hebdo = 288 sc, largement couvert
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBeGreaterThan(75); // « La paie est régulière » = +1d10
    expect(v.morale.factors).toEqual([]); // le facteur de paie est injecté pour le recalcul, jamais persisté
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(useGame.getState().money)).toBe(toBrass({ gold: 10, silver: 0, brass: 0 }) - 288);
    expect(useGame.getState().journal.join('\n')).toMatch(/Solde hebdomadaire de l'équipage versée/);
  });

  it('bourse insuffisante → pas-de-paie (−3d10) + dette accumulée, bourse intacte', () => {
    useGame.setState({
      money: { gold: 0, silver: 10, brass: 0 }, // 120 sc < 288
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
    });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.score).toBeLessThan(75); // « Pas de paie »
    expect(v.wagesOwed).toBe(288); // solve due cumulée en sous de cuivre
    expect(toBrass(useGame.getState().money)).toBe(120); // rien n'est prélevé
    expect(useGame.getState().journal.join('\n')).toMatch(/Bourse insuffisante pour la solde/);
  });

  it('sans équipage salarié → aucun prélèvement, Moral inchangé (non-régression)', () => {
    useGame.setState({
      money: { gold: 5, silver: 0, brass: 0 },
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    });
    useGame.getState().advanceTime(8 * MINUTES_PER_DAY);
    const v = useGame.getState().vessel!;
    expect(v.morale.lastMoraleWeek).toBe(1);
    expect(v.morale.score).toBe(75); // aucun facteur actif → delta 0
    expect(v.wagesOwed).toBeUndefined();
    expect(toBrass(useGame.getState().money)).toBe(toBrass({ gold: 5, silver: 0, brass: 0 })); // bourse intacte
  });
});
