import { describe, it, expect, afterEach } from 'vitest';
import { advantageCap, advantageCapFor, gainAdvantage } from './advantage';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';

const c = (advantage: number) => ({ advantage }) as Combatant;
const ci = (advantage: number, I: number) =>
  ({ advantage, characteristics: { I }, conditions: [], weapons: [], activeEffects: [], liveTraits: [] }) as unknown as Combatant;

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

describe('Plafond d’Avantage = Bonus d’Initiative (LDB 15-Dépl l.15, règle optionnelle)', () => {
  afterEach(() => { resetRule('combat-advantage-cap-bi'); resetRule('combat-advantage-cap'); });
  it('off (défaut) : advantageCapFor = plafond fixe', () => {
    expect(advantageCapFor(ci(0, 45))).toBe(10);
  });
  it('on : advantageCapFor = Bonus d’Initiative (dizaines de l’Initiative), prime sur le plafond fixe', () => {
    setRule('combat-advantage-cap-bi', true);
    expect(advantageCapFor(ci(0, 45))).toBe(4); // BI = 4
    expect(advantageCapFor(ci(0, 38))).toBe(3); // BI = 3
  });
  it('gainAdvantage clampe au Bonus d’Initiative quand la règle est active', () => {
    setRule('combat-advantage-cap-bi', true);
    const a = ci(2, 45); gainAdvantage(a, 10); expect(a.advantage).toBe(4);
  });
});
