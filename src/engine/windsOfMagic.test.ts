import { describe, it, expect } from 'vitest';
import { windsModFromRoll, rollWindsOfMagic, hasSecondeVue } from './windsOfMagic';
import { makeRNG } from './dice';
import type { Combatant } from './types';

/** Option : Vents Tourbillonnants (LDB 46 l.179-190). Table verbatim l.183-190. */
describe('windsOfMagic — Tableau des Vents Tourbillonnants (LDB 46 l.183-190)', () => {
  it('mappe chaque fourchette 1d10 sur son modificateur verbatim', () => {
    expect(windsModFromRoll(1)).toBe(-30);
    expect(windsModFromRoll(2)).toBe(-10);
    expect(windsModFromRoll(3)).toBe(-10);
    expect(windsModFromRoll(4)).toBe(0);
    expect(windsModFromRoll(5)).toBe(0);
    expect(windsModFromRoll(6)).toBe(0);
    expect(windsModFromRoll(7)).toBe(0);
    expect(windsModFromRoll(8)).toBe(10);
    expect(windsModFromRoll(9)).toBe(10);
    expect(windsModFromRoll(10)).toBe(30);
  });

  it('tirage SEEDÉ : même seed → même force (déterminisme, coop/replay)', () => {
    const a = rollWindsOfMagic(makeRNG(1234));
    const b = rollWindsOfMagic(makeRNG(1234));
    expect(a).toEqual(b);
    expect(a.mod).toBe(windsModFromRoll(a.roll));
  });

  it('hasSecondeVue : comparaison DIRECTE par id (talentId), pas hasTalent() littéral', () => {
    const withTalent = { talents: [{ talentId: 'seconde-vue', times: 1 }] } as unknown as Combatant;
    const without = { talents: [{ talentId: 'diction-instinctive', times: 1 }] } as unknown as Combatant;
    const zeroTimes = { talents: [{ talentId: 'seconde-vue', times: 0 }] } as unknown as Combatant;
    expect(hasSecondeVue(withTalent)).toBe(true);
    expect(hasSecondeVue(without)).toBe(false);
    expect(hasSecondeVue(zeroTimes)).toBe(false);
  });
});
