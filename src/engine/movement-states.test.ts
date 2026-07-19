import { describe, it, expect } from 'vitest';
import { effectiveMovement } from './encumbrance';
import type { Combatant } from './types';

function mk(conditions: { id: string; value: number }[] = []): Combatant {
  return {
    movement: 4,
    characteristics: { force: 30, endurance: 30 } as never,
    conditions,
    items: [],
    talents: [],
  } as unknown as Combatant;
}

describe('effectiveMovement — restrictions de Mouvement par État (LDB 16)', () => {
  it('sain → Mouvement plein', () => {
    expect(effectiveMovement(mk())).toBe(4);
  });
  it('À Terre → demi-Mouvement (ramper, l.37)', () => {
    expect(effectiveMovement(mk([{ id: 'a-terre', value: 1 }]))).toBe(2);
  });
  it('Sonné → demi-Mouvement (l.123)', () => {
    expect(effectiveMovement(mk([{ id: 'sonne', value: 1 }]))).toBe(2);
  });
  it('Empêtré → 0, impossible de se déplacer (l.85)', () => {
    expect(effectiveMovement(mk([{ id: 'empetre', value: 1 }]))).toBe(0);
  });
});
