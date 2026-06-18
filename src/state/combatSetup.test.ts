import { describe, it, expect } from 'vitest';
import { rollInitiative } from './combatSetup';
import { makeRNG } from '../engine/dice';
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
