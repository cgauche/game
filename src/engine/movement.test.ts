import { describe, it, expect } from 'vitest';
import { resolveRun } from './movement';
import { makeRNG } from './dice';

describe('resolveRun — Course (Athlétisme +20, LDB 15-Déplacement l.79-82)', () => {
  it('succès (Athlétisme élevé +20) → bonus de Course ≥ 2×Mouvement (DR ≥ 0)', () => {
    const r = resolveRun(90, 4, makeRNG(3));
    expect(r.success).toBe(true);
    expect(r.bonusCases).toBeGreaterThanOrEqual(8); // 2×Mouvement (cases)
    expect(typeof r.roll).toBe('number');
  });

  it('bonus = max(0, 2×Mouvement + round(DR/2)) — jamais négatif', () => {
    const r = resolveRun(20, 5, makeRNG(7));
    expect(r.bonusCases).toBe(Math.max(0, 2 * 5 + Math.round(r.dr / 2)));
    expect(r.bonusCases).toBeGreaterThanOrEqual(0);
  });
});
