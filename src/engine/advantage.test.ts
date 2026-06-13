import { describe, it, expect, afterEach } from 'vitest';
import { advantageCap, gainAdvantage } from './advantage';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';

const c = (advantage: number) => ({ advantage }) as Combatant;

describe('gainAdvantage — plafond « Limiter les Avantages » (LDB 15-Dépl l.17)', () => {
  afterEach(() => resetRule('combat-advantage-cap'));
  it('gagne n (défaut 1) et clampe au plafond (défaut 10)', () => {
    expect(advantageCap()).toBe(10);
    const a = c(0); gainAdvantage(a); expect(a.advantage).toBe(1);
    const b = c(9); gainAdvantage(b, 2); expect(b.advantage).toBe(advantageCap());
    const d = c(10); gainAdvantage(d); expect(d.advantage).toBe(10);
  });
  it('n ≤ 0 est sans effet (jamais une perte)', () => {
    const a = c(5); gainAdvantage(a, 0); gainAdvantage(a, -3); expect(a.advantage).toBe(5);
  });
  it('le plafond suit la règle in-game (preuve « un seul edit »)', () => {
    setRule('combat-advantage-cap', 5);
    const a = c(4); gainAdvantage(a, 10); expect(a.advantage).toBe(5);
  });
});
