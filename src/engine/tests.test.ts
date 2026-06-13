import { describe, it, expect, afterEach } from 'vitest';
import { evaluateTest, maxForcedRoll } from './tests';
import type { TestPolicy } from './testPolicy';
import { setRule, resetRule } from './policy';

const P = (over: Partial<TestPolicy> = {}): TestPolicy => ({
  autoSuccessMax: 5, autoFailMin: 96, bandsMode: 'normal', slMode: 'standard', targetMin: 1, targetMax: 99, ...over,
});

describe('evaluateTest — bandes automatiques (LDB 12 l.46-47, l.147-149)', () => {
  it("'normal' : 01-05 = réussite auto même si cible < jet ; DR ≥ +1", () => {
    const t = evaluateTest(3, 0, P()); // 3 > 0 → échec « numérique », mais bande basse
    expect(t.success).toBe(true);
    expect(t.sl).toBeGreaterThanOrEqual(1);
  });
  it("'normal' : 96-00 = échec auto même si jet ≤ cible ; DR ≤ -1", () => {
    const t = evaluateTest(98, 99, P()); // 98 ≤ 99 → réussite « numérique », mais bande haute
    expect(t.success).toBe(false);
    expect(t.sl).toBeLessThanOrEqual(-1);
  });
  it("'off' : aucune bande (comportement historique = jet ≤ cible)", () => {
    expect(evaluateTest(3, 0, P({ bandsMode: 'off' })).success).toBe(false);
    expect(evaluateTest(98, 99, P({ bandsMode: 'off' })).success).toBe(true);
  });
  it("'inverted' : 01-05 échec auto / 96-00 réussite auto (règle maison)", () => {
    expect(evaluateTest(3, 99, P({ bandsMode: 'inverted' })).success).toBe(false);
    expect(evaluateTest(98, 0, P({ bandsMode: 'inverted' })).success).toBe(true);
  });
});

describe('evaluateTest — DR rapide (« Calculer Rapidement un DR », LDB 12 l.128)', () => {
  it("'fast' : sur une réussite, DR = chiffre des dizaines du JET", () => {
    expect(evaluateTest(36, 80, P({ slMode: 'fast' })).sl).toBe(3); // dizaines de 36
    expect(evaluateTest(36, 80, P()).sl).toBe(5); // standard : 8 − 3
  });
  it("'fast' : sur un échec, DR calculé normalement", () => {
    const t = evaluateTest(70, 30, P({ slMode: 'fast' }));
    expect(t.success).toBe(false);
    expect(t.sl).toBe(-4); // standard négatif : 3 − 7
  });
});

describe('maxForcedRoll — borne du dé forcé DÉRIVÉE de la policy (pas un nombre en dur)', () => {
  it("'normal' : ≤ cible ET ≤ autoFailMin − 1 (96-00 échoue toujours, LDB 12 l.46)", () => {
    expect(maxForcedRoll(99, P())).toBe(95);
    expect(maxForcedRoll(40, P())).toBe(40);
  });
  it("'off' : pas de bande d'échec auto → plafonné à la cible", () => {
    expect(maxForcedRoll(99, P({ bandsMode: 'off' }))).toBe(99);
  });
});

describe('Bascule in-game : éditer UNE règle change le comportement (preuve « un seul edit »)', () => {
  afterEach(() => { resetRule('test-auto-bands'); resetRule('test-fast-sl'); });
  it('test-auto-bands → inverted : evaluateTest (policy par défaut) suit la surcharge', () => {
    expect(evaluateTest(3, 99).success).toBe(true); // normal
    setRule('test-auto-bands', 'inverted');
    expect(evaluateTest(3, 99).success).toBe(false); // bande basse = échec auto
  });
  it('test-fast-sl → true : DR rapide sans autre édition', () => {
    expect(evaluateTest(36, 80).sl).toBe(5); // standard
    setRule('test-fast-sl', true);
    expect(evaluateTest(36, 80).sl).toBe(3); // dizaines du jet
  });
});
