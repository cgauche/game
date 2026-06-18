import { describe, it, expect, afterEach } from 'vitest';
import { rollInitiative } from './combatSetup';
import { makeRNG } from '../engine/dice';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

describe('combatSetup — rollInitiative (LDB 13, seam init-method)', () => {
  const c = (over: Partial<Combatant> = {}) =>
    ({ characteristics: { I: 40 }, liveTraits: [], talents: [], ...over }) as unknown as Combatant;

  it('= Initiative de base (profil+traits) + 1d10 + Combat instinctif (0 sans le talent)', () => {
    const expected1d10 = makeRNG(5).int(1, 10); // RNG identique, même 1ᵉʳ tirage
    expect(rollInitiative(c(), makeRNG(5))).toBe(40 + expected1d10);
  });

  it('consomme exactement un tirage du RNG (ordre préservé dans la boucle appelante)', () => {
    const rng = makeRNG(9);
    rollInitiative(c(), rng); // 1 appel à int(1,10)
    const probe = makeRNG(9);
    probe.int(1, 10); // avance d'un tirage
    expect(rng.int(1, 10)).toBe(probe.int(1, 10)); // le RNG est au même point → 1 seul tirage consommé
  });
});

describe('rollInitiative — règle « méthode d’Initiative » (combat-init-method, LDB 13 l.39)', () => {
  afterEach(() => resetRule('combat-init-method'));
  const ci = () => ({ characteristics: { I: 45, Ag: 30 }, liveTraits: [], talents: [], activeEffects: [] }) as unknown as Combatant;

  it('défaut (roll-i) : 1d10 + Initiative — inchangé', () => {
    const d = makeRNG(3).int(1, 10);
    expect(rollInitiative(ci(), makeRNG(3))).toBe(45 + d);
  });
  it('fixed-i : Initiative fixe, sans dé (ne consomme pas le RNG)', () => {
    setRule('combat-init-method', 'fixed-i');
    const rng = makeRNG(3);
    expect(rollInitiative(ci(), rng)).toBe(45);
    expect(rng.int(1, 10)).toBe(makeRNG(3).int(1, 10)); // RNG intact : aucun tirage consommé
  });
  it('roll-bi : 1d10 + Bonus d’Initiative (4) + Bonus d’Agilité (3)', () => {
    setRule('combat-init-method', 'roll-bi');
    const d = makeRNG(3).int(1, 10);
    expect(rollInitiative(ci(), makeRNG(3))).toBe(d + 4 + 3);
  });
});
