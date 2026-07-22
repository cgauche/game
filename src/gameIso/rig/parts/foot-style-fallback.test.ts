import { describe, it, expect } from 'vitest';
import { resolveWardrobeId } from './career';
import { TENUE_BAREFOOT, TENUE_FOOT_STYLE, TENUE_BY_ID } from './tenues';

// Divergence fallback pied, décision Nu→plain 2026-07-21 : le pied doit suivre la même
// résolution que le corps (repli Nu), jamais keyer sur la clé brute non résolue.
function footStyleFor(tenueKey: string | undefined): 'boot' | 'claw' | 'plain' {
  const resolved = resolveWardrobeId(tenueKey);
  return TENUE_FOOT_STYLE.get(resolved) ?? 'boot';
}

describe('foot style — suit la résolution de tenue, jamais la clé brute', () => {
  it('tenueKey undefined → repli Nu → pied plain (pas boot)', () => {
    expect(footStyleFor(undefined)).toBe('plain');
  });

  it("tenueKey vide → repli Nu → pied plain", () => {
    expect(footStyleFor('')).toBe('plain');
  });

  it("tenueKey 'nu' explicite → pied plain", () => {
    expect(footStyleFor('nu')).toBe('plain');
  });

  it('tenue chaussée connue (soldat) → pied boot inchangé', () => {
    expect(TENUE_BY_ID.soldat).toBeDefined();
    expect(footStyleFor('soldat')).toBe('boot');
  });

  it('tenue monstre bareFoot connue (squelette) → pied claw inchangé', () => {
    expect(TENUE_BAREFOOT.has('squelette')).toBe(true);
    expect(footStyleFor('squelette')).toBe('claw');
  });
});
