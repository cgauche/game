import { describe, it, expect } from 'vitest';
import { loseWounds, hasCondition } from './conditions';
import type { Combatant } from './types';

function mk(current: number, advantage: number, conditions: { name: string; value: number }[] = []): Combatant {
  return { name: 'X', wounds: { current, max: 10 }, advantage, conditions } as unknown as Combatant;
}

describe('loseWounds — perte de PB centralisée + conséquences (LDB 15 l.40 / 18 l.28)', () => {
  it('perdre ≥1 PB → perd TOUT l’Avantage', () => {
    const c = mk(8, 3);
    expect(loseWounds(c, 5)).toBe(5);
    expect(c.wounds.current).toBe(3);
    expect(c.advantage).toBe(0);
  });

  it('tomber à 0 PB → Avantage 0 + État À Terre', () => {
    const c = mk(3, 2);
    loseWounds(c, 5);
    expect(c.wounds.current).toBe(0);
    expect(c.advantage).toBe(0);
    expect(hasCondition(c, 'À Terre')).toBe(true);
  });

  it('déjà à 0 PB → aucune perte, Avantage inchangé', () => {
    const c = mk(0, 2);
    expect(loseWounds(c, 5)).toBe(0);
    expect(c.advantage).toBe(2);
  });

  it('montant ≤ 0 → no-op (pas de perte d’Avantage)', () => {
    const c = mk(5, 2);
    expect(loseWounds(c, 0)).toBe(0);
    expect(c.advantage).toBe(2);
  });
});
