import { describe, it, expect } from 'vitest';
import { repairCostBrass } from './repair';

describe('repair — réparation armure (LDB 63 l.97-98)', () => {
  it('10 % du prix de base par PA perdu', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 1 } as any, 120)).toBe(12); // 1 PA perdu × 10 % de 120
    expect(repairCostBrass({ pa: 3, damageTaken: 2 } as any, 120)).toBe(24); // 2 PA × 10 %
  });
  it('pièce brisée (PA nette 0) → 30 % du prix de base', () => {
    expect(repairCostBrass({ pa: 1, damageTaken: 1 } as any, 100)).toBe(30); // brisée → 30 %
  });
  it('non endommagée → 0', () => {
    expect(repairCostBrass({ pa: 2, damageTaken: 0 } as any, 100)).toBe(0);
  });
});
