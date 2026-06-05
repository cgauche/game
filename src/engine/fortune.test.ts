import { describe, it, expect } from 'vitest';
import { canReroll } from './fortune';

describe('canReroll — Chance : relance 1×/Test sur jet propre raté (LDB ch.12 l.56 + ch.12 l.29-31)', () => {
  it('jet raté, pas encore relancé → relance possible', () => {
    expect(canReroll(true, false)).toBe(true);
  });
  it('jet raté mais déjà relancé → impossible (1 relance max, l.56)', () => {
    expect(canReroll(true, true)).toBe(false);
  });
  it('jet réussi → impossible (relance réservée aux Tests échoués, l.24)', () => {
    expect(canReroll(false, false)).toBe(false);
  });
  it('jet réussi et déjà relancé → impossible', () => {
    expect(canReroll(false, true)).toBe(false);
  });
});
