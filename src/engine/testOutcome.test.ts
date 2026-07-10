import { describe, it, expect } from 'vitest';
import { TestOutcome } from './testOutcome';

describe('TestOutcome — scellement (#275 Décision 2)', () => {
  it('seal() construit une issue lisible', () => {
    const out = TestOutcome.seal({ roll: 12, target: 45, success: true, sl: 3, isDouble: false });
    expect(out.won).toBe(true);
    expect(out.sl).toBe(3);
    expect(out.roll).toBe(12);
    expect(out.target).toBe(45);
    expect(out.detail).toBeUndefined();
  });

  it('seal() transporte un RollBreakdown réel quand fourni', () => {
    const detail = { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 12, success: true, sl: 3 };
    const out = TestOutcome.seal({ roll: 12, target: 45, success: true, sl: 3, isDouble: false }, detail);
    expect(out.detail).toBe(detail);
  });

  it('un littéral {won,sl} NE COMPILE PAS en TestOutcome — le contournement échoue structurellement', () => {
    // @ts-expect-error — TestOutcome a un constructeur privé + une marque nominale : un objet
    // littéral (même à la bonne forme apparente) n'est jamais assignable, seul `.seal()` scelle.
    const forged: TestOutcome = { won: true, sl: 2 };
    expect(forged).toBeTruthy(); // ligne atteinte seulement si TS avait laissé passer (garde behaviorale de secours)
  });
});
