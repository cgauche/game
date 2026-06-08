import { describe, it, expect } from 'vitest';
import { toBrass, fromBrass, add, subtract, canAfford, formatMoney, priceToMoney } from './money';

describe('money — monnaie impériale (LDB 57 : 1 CO=20 SC=240 PA, 1 SC=12 PA)', () => {
  it('toBrass : convertit en sous de cuivre', () => {
    expect(toBrass({ gold: 1, silver: 0, brass: 0 })).toBe(240);
    expect(toBrass({ gold: 0, silver: 1, brass: 0 })).toBe(12);
    expect(toBrass({ gold: 2, silver: 3, brass: 5 })).toBe(480 + 36 + 5);
  });
  it('fromBrass : normalise (greedy CO puis SC puis PA)', () => {
    expect(fromBrass(521)).toEqual({ gold: 2, silver: 3, brass: 5 }); // 480+36+5
    expect(fromBrass(0)).toEqual({ gold: 0, silver: 0, brass: 0 });
  });
  it('add/subtract via le total en PA', () => {
    expect(add({ gold: 1, silver: 0, brass: 0 }, { gold: 0, silver: 0, brass: 13 })).toEqual({ gold: 1, silver: 1, brass: 1 });
    expect(subtract({ gold: 1, silver: 0, brass: 0 }, { gold: 0, silver: 5, brass: 0 })).toEqual({ gold: 0, silver: 15, brass: 0 });
    expect(subtract({ gold: 0, silver: 0, brass: 5 }, { gold: 0, silver: 1, brass: 0 })).toBeNull(); // insuffisant
  });
  it('canAfford', () => {
    expect(canAfford({ gold: 1, silver: 0, brass: 0 }, { gold: 0, silver: 19, brass: 11 })).toBe(true); // 240 ≥ 239
    expect(canAfford({ gold: 0, silver: 0, brass: 5 }, { gold: 0, silver: 1, brass: 0 })).toBe(false);
  });
  it('priceToMoney : data {gold,silver,bronze} → Money (bronze = brass = sou de cuivre)', () => {
    expect(priceToMoney({ gold: 2, silver: 0, bronze: 0 })).toEqual({ gold: 2, silver: 0, brass: 0 });
    expect(priceToMoney({ silver: 3 })).toEqual({ gold: 0, silver: 3, brass: 0 });
  });
  it('formatMoney : noms canon FR (CO / pa / sc), omet les zéros', () => {
    expect(formatMoney({ gold: 2, silver: 3, brass: 0 })).toBe('2 CO 3 pa'); // couronne d'or, pistole d'argent
    expect(formatMoney({ gold: 0, silver: 0, brass: 5 })).toBe('5 sc'); // sou de cuivre
    expect(formatMoney({ gold: 0, silver: 0, brass: 0 })).toBe('0 sc');
  });
});
