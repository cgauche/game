import { describe, it, expect } from 'vitest';
import { maxBy } from './pick';

describe('maxBy — argmax générique, tie-break PREMIER maximum', () => {
  it('collection vide → null', () => {
    expect(maxBy([], (x: number) => x)).toBeNull();
  });

  it('renvoie l’élément maximisant le score + sa valeur', () => {
    const r = maxBy([{ n: 1 }, { n: 5 }, { n: 3 }], (x) => x.n)!;
    expect(r.item.n).toBe(5);
    expect(r.value).toBe(5);
  });

  it('ex æquo → conserve le PREMIER rencontré (strict >)', () => {
    const a = { id: 'a', n: 7 }, b = { id: 'b', n: 7 }, c = { id: 'c', n: 4 };
    const r = maxBy([a, b, c], (x) => x.n)!;
    expect(r.item.id).toBe('a'); // a et b à 7 → a (rencontré en premier)
    expect(r.value).toBe(7);
  });

  it('scores négatifs (pas de repli à 0)', () => {
    const r = maxBy([-8, -3, -12], (x: number) => x)!;
    expect(r.item).toBe(-3);
    expect(r.value).toBe(-3);
  });

  it('accepte tout Iterable (Set)', () => {
    const r = maxBy(new Set([2, 9, 9, 1]), (x) => x)!;
    expect(r.item).toBe(9);
  });
});
