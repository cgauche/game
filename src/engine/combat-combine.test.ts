import { describe, it, expect } from 'vitest';
import { combineMods } from './combat';

describe('combineMods — Combiner les Difficultés (LDB 14 l.126-131)', () => {
  it('plafonne la somme des malus à -30', () => {
    expect(combineMods([{ label: 'a', value: -20 }, { label: 'b', value: -20 }])).toBe(-30);
  });
  it('plafonne la somme des bonus à +60', () => {
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: 40 }])).toBe(60);
  });
  it('mélange bonus + malus se somme (plafonds séparés)', () => {
    expect(combineMods([{ label: 'a', value: 40 }, { label: 'b', value: -20 }])).toBe(20);
  });
  it('Avantage est hors plafond (uncapped)', () => {
    // Avantage +70 hors cap, + malus -40 plafonné -30 → +40
    expect(
      combineMods([
        { label: 'Avantage', value: 70, uncapped: true },
        { label: 'x', value: -20 },
        { label: 'y', value: -20 },
      ]),
    ).toBe(40);
  });
  it('liste vide → 0', () => {
    expect(combineMods([])).toBe(0);
  });
});
