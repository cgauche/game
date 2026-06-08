import { describe, it, expect } from 'vitest';
import { bargainBuyFactor, bargainSellFactor } from './bargain';

describe('bargain — Marchandage RAW (LDB 60 l.12 / l.22)', () => {
  it('achat : perdu → 1, gagné → 0.9, gagné DR≥6 ou Négociateur → 0.8', () => {
    expect(bargainBuyFactor(false, 0, false)).toBe(1);
    expect(bargainBuyFactor(true, 0, false)).toBe(0.9);
    expect(bargainBuyFactor(true, 6, false)).toBe(0.8);
    expect(bargainBuyFactor(true, 2, true)).toBe(0.8); // Négociateur
  });
  it('vente (sur la base ½) : gagné → 1 (½), perdu → 0.5 (¼)', () => {
    expect(bargainSellFactor(true, 0, false)).toBe(1);
    expect(bargainSellFactor(false, 0, false)).toBe(0.5);
  });
});
