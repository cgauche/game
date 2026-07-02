import { describe, it, expect } from 'vitest';
import { toBrass, fromBrass, add, subtract, canAfford, formatMoney, priceToMoney, statusBudgetBrass, withinStatusBudget, parseStatus } from './money';

describe('« Tenir les comptes » — budget par Statut (LDB 59 l.9-11)', () => {
  it('statusBudgetBrass : Bronze N = N sous, Argent N = N pistoles, Or N = N couronnes', () => {
    expect(statusBudgetBrass('bronze', 2)).toBe(2); // 2 sous
    expect(statusBudgetBrass('argent', 2)).toBe(24); // 2 pistoles = 24 sous
    expect(statusBudgetBrass('or', 3)).toBe(720); // 3 couronnes = 720 sous
  });
  it('withinStatusBudget : « Statut Argent 2 » → un objet ≤ 2 pistoles est toujours abordable', () => {
    expect(withinStatusBudget(24, 'argent', 2)).toBe(true); // pile 2 pistoles
    expect(withinStatusBudget(25, 'argent', 2)).toBe(false); // au-delà
  });
  it('parseStatus : décompose « Argent 2 » / « Bronze 1 » / libellé inconnu', () => {
    expect(parseStatus('Argent 2')).toEqual({ tier: 'argent', standing: 2 });
    expect(parseStatus('Bronze 1')).toEqual({ tier: 'bronze', standing: 1 });
    expect(parseStatus('—')).toBeNull();
    expect(parseStatus(undefined)).toBeNull();
  });
});

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
  it('formatMoney : nomenclature canon LDB 57 (CO / pistoles « S/C » / sc), omet les zéros', () => {
    expect(formatMoney({ gold: 2, silver: 3, brass: 0 })).toBe('2 CO 3/–'); // couronne d'or + 3 pistoles, pas de sou
    expect(formatMoney({ gold: 0, silver: 3, brass: 3 })).toBe('3/3'); // pistoles + sous mélangés (LDB 57 « 6/8 »)
    expect(formatMoney({ gold: 0, silver: 20, brass: 0 })).toBe('20/–'); // LDB 57 « 20/– »
    expect(formatMoney({ gold: 0, silver: 0, brass: 5 })).toBe('5 sc'); // sous seuls
    expect(formatMoney({ gold: 0, silver: 0, brass: 0 })).toBe('0 sc');
  });
});
