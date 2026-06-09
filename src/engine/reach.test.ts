import { describe, it, expect } from 'vitest';
import { reachTiles, meleeReachTiles } from './engagement';
import type { Weapon } from './types';

const w = (over: Partial<Weapon>): Weapon => ({ name: 'X', type: 'melee', damage: '+BF', qualities: [], ...over } as Weapon);

/**
 * Allonge = portée d'ENGAGEMENT/d'attaque de mêlée (LDB 62 l.211 « Très longue » → 4 m ; l.213
 * « Considérable » → 6 m), convertie en cases avec 1 case = 2 m (LDB 15 l.55). L'Option « Longueur
 * d'Arme / Combat au Contact » (LDB 62 l.215-222, optionnelle) n'est PAS implémentée.
 */
describe('reachTiles — Allonge d’engagement', () => {
  it('Très longue = 2 cases (4 m)', () => expect(reachTiles(w({ reach: 'Très longue' }))).toBe(2));
  it('Considérable = 3 cases (6 m)', () => expect(reachTiles(w({ reach: 'Considérable' }))).toBe(3));
  it('Moyenne / Longue / Très courte = contact (1 case)', () => {
    expect(reachTiles(w({ reach: 'Moyenne' }))).toBe(1);
    expect(reachTiles(w({ reach: 'Longue' }))).toBe(1);
    expect(reachTiles(w({ reach: 'Très courte' }))).toBe(1);
  });
  it('arme à distance, sans Allonge, ou absente → 1', () => {
    expect(reachTiles(w({ type: 'ranged', reach: null }))).toBe(1);
    expect(reachTiles(w({ reach: null }))).toBe(1);
    expect(reachTiles(undefined)).toBe(1);
  });
});

describe('meleeReachTiles — Allonge de l’arme de mêlée d’un combattant', () => {
  it('prend l’arme de MÊLÉE (ignore l’arme à distance)', () => {
    expect(meleeReachTiles([w({ type: 'ranged' }), w({ reach: 'Très longue' })])).toBe(2);
  });
  it('arme de mêlée normale → 1 ; aucune arme → 1', () => {
    expect(meleeReachTiles([w({ reach: 'Moyenne' })])).toBe(1);
    expect(meleeReachTiles([])).toBe(1);
  });
});
