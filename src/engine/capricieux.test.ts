import { describe, it, expect } from 'vitest';
import { capriciousMod } from './social';

/**
 * Capricieux (Trait de créature, T2C ch.13) : le d10 de tempérament de la créature module un Test de
 * Sociabilité mené AVEC elle. Exprimé en mod de VALEUR (±10 par DR, convention `statusCharmMod`) — la table
 * RAW « ±N DR » se traduit 1→−2, 2-3→−1, 4-7→0, 8-9→+1, 10→+2.
 */
describe('capriciousMod — table d10 (T2C ch.13)', () => {
  it('1 → −20 (−2 DR)', () => expect(capriciousMod(1)).toBe(-20));
  it('2-3 → −10 (−1 DR)', () => { expect(capriciousMod(2)).toBe(-10); expect(capriciousMod(3)).toBe(-10); });
  it('4-7 → 0 (DR indiqué)', () => { for (const r of [4, 5, 6, 7]) expect(capriciousMod(r)).toBe(0); });
  it('8-9 → +10 (+1 DR)', () => { expect(capriciousMod(8)).toBe(10); expect(capriciousMod(9)).toBe(10); });
  it('10 → +20 (+2 DR)', () => expect(capriciousMod(10)).toBe(20));
});
