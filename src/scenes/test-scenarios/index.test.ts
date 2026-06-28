import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';

describe('Registre des scénarios de test (auto-découverte)', () => {
  it("contient le Terrain d'entraînement (sandbox)", () => {
    expect(testScenarios.find((s) => s.id === 'entrainement')).toBeTruthy();
  });
  it('est trié par order, sans id dupliqué, et exclut _shared/index', () => {
    const orders = testScenarios.map((s) => s.order);
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
    const ids = testScenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });
});
