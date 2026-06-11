/** Tableau des Événements (LDB 22) : couverture d100 complète, entrées mécaniques connues. */
import { describe, it, expect } from 'vitest';
import { INTERLUDE_EVENTS, interludeEventFor } from './interludeEvents';

describe('INTERLUDE_EVENTS — intégrité de la table (LDB 22)', () => {
  it('couvre 01-100 sans trou ni chevauchement', () => {
    for (let r = 1; r <= 100; r++) {
      const hits = INTERLUDE_EVENTS.filter((e) => r >= e.min && r <= e.max);
      expect(hits, `jet ${r}`).toHaveLength(1);
    }
  });
  it('bornes contiguës et croissantes', () => {
    expect(INTERLUDE_EVENTS[0].min).toBe(1);
    expect(INTERLUDE_EVENTS[INTERLUDE_EVENTS.length - 1].max).toBe(100);
    for (let i = 1; i < INTERLUDE_EVENTS.length; i++) {
      expect(INTERLUDE_EVENTS[i].min).toBe(INTERLUDE_EVENTS[i - 1].max + 1);
    }
  });
  it('effets mécaniques connus (échantillon verbatim)', () => {
    expect(interludeEventFor(23).fx?.moneyPct).toBe(-30); // le Prévôt arrive
    expect(interludeEventFor(35).fx?.fortuneMaxDelta).toBe(1); // un homme averti
    expect(interludeEventFor(38).fx?.loseActivity).toBe(true); // Festivités
    expect(interludeEventFor(84).fx?.moneyPct).toBe(-50); // Kleptomane
    expect(interludeEventFor(78).fx?.stashRaided).toBe(true); // Mise à sac
    expect(interludeEventFor(31).fx?.revenueClasses).toEqual(['Riverains']); // Profits abondants
    expect(interludeEventFor(58).fx?.revenueBlockedClasses).toEqual(['*']); // Complications monstrueuses
  });
  it('les événements purement narratifs ne portent AUCUN fx (rien d’inventé)', () => {
    for (const roll of [8, 16, 46, 62, 70, 93]) {
      expect(interludeEventFor(roll).fx, `jet ${roll}`).toBeUndefined();
    }
  });
});
