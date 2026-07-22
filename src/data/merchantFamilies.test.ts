import { describe, it, expect } from 'vitest';
import { merchantFamilies } from './index';
import { MERCHANT_COL_RENDERERS } from '../ui/MerchantPanel';

describe('merchantFamilies — cohérence des familles de présentation du marchand', () => {
  it('chaque colonne référencée existe dans le registre de renderers', () => {
    for (const f of merchantFamilies) {
      for (const col of f.columns) {
        expect(MERCHANT_COL_RENDERERS[col], `${f.id}: colonne fantôme "${col}"`).toBeDefined();
      }
    }
  });

  it('au plus une famille par règle de `match` (unit / shield / trappingType)', () => {
    const unitFamilies = merchantFamilies.filter((f) => f.match.unit);
    const shieldFamilies = merchantFamilies.filter((f) => f.match.shield);
    expect(unitFamilies.length).toBeLessThanOrEqual(1);
    expect(shieldFamilies.length).toBeLessThanOrEqual(1);
    const trappingTypes = merchantFamilies.filter((f) => f.match.trappingType).map((f) => f.match.trappingType as string);
    expect(new Set(trappingTypes).size).toBe(trappingTypes.length);
  });

  it('exactement une famille fallback (`match` vide) — `familyOf` a un défaut', () => {
    const fallbacks = merchantFamilies.filter((f) => !f.match.trappingType && !f.match.shield && !f.match.unit);
    expect(fallbacks.length).toBe(1);
  });
});
