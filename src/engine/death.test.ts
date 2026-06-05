import { describe, it, expect } from 'vitest';
import { isOutOfAction, usesSuddenDeath, applyZeroWounds, tickDeath, hasCondition } from './conditions';
import { makeRNG } from './dice';
import type { Combatant } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'C',
    kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, // BE=3
    wounds: { current: 10, max: 12 },
    conditions: [],
    skills: [],
    ...over,
  }) as unknown as Combatant;

describe('Modèle de mort (LDB 18-Traumatisme)', () => {
  it("héros à 0 PB n'est PAS hors de combat (À Terre, agit encore)", () => {
    expect(isOutOfAction(mk({ wounds: { current: 0, max: 12 } }))).toBe(false);
  });
  it('ennemi à 0 PB est hors de combat (Mort Subite)', () => {
    const e = mk({ kind: 'enemy', wounds: { current: 0, max: 12 } });
    expect(usesSuddenDeath(e)).toBe(true);
    expect(isOutOfAction(e)).toBe(true);
  });
  it('Inconscient ou mort = hors de combat', () => {
    expect(isOutOfAction(mk({ conditions: [{ name: 'Inconscient', value: 1 }] }))).toBe(true);
    expect(isOutOfAction(mk({ dead: true }))).toBe(true);
  });
  it('applyZeroWounds : à 0 PB → À Terre', () => {
    const h = mk({ wounds: { current: 0, max: 12 } });
    applyZeroWounds(h);
    expect(hasCondition(h, 'À Terre')).toBe(true);
  });
  it('tickDeath : à 0 PB, Inconscient après BE rounds', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, roundsAtZero: 3 }); // BE=3 ; 3→4 > 3
    tickDeath(h, makeRNG(1));
    expect(hasCondition(h, 'Inconscient')).toBe(true);
  });
  it('tickDeath : Inconscient + 0 PB + critiques > BE → mort', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // BE=3
    tickDeath(h, makeRNG(1));
    expect(h.dead).toBe(true);
  });
  it('tickDeath : un combattant guéri (PB>0) remet roundsAtZero à 0', () => {
    const h = mk({ wounds: { current: 5, max: 12 }, roundsAtZero: 2 });
    tickDeath(h, makeRNG(1));
    expect(h.roundsAtZero).toBe(0);
  });
});
