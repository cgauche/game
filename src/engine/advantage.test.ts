import { describe, it, expect } from 'vitest';
import { ADVANTAGE_CAP, gainAdvantage } from './advantage';
import type { Combatant } from './types';

const c = (advantage: number) => ({ advantage }) as Combatant;

describe('gainAdvantage — plafond 10 (Option RAW LDB 15-Dépl l.17)', () => {
  it('gagne n (défaut 1) et clampe au plafond', () => {
    const a = c(0); gainAdvantage(a); expect(a.advantage).toBe(1);
    const b = c(9); gainAdvantage(b, 2); expect(b.advantage).toBe(ADVANTAGE_CAP);
    const d = c(10); gainAdvantage(d); expect(d.advantage).toBe(10);
  });
  it('n ≤ 0 est sans effet (jamais une perte)', () => {
    const a = c(5); gainAdvantage(a, 0); gainAdvantage(a, -3); expect(a.advantage).toBe(5);
  });
});
