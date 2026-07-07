import { describe, it, expect } from 'vitest';
import { hashSeed } from './dice';

describe('hashSeed', () => {
  it('est déterministe pour une même chaîne', () => {
    expect(hashSeed('ent-1')).toBe(hashSeed('ent-1'));
  });
  it('diffère pour des chaînes différentes', () => {
    expect(hashSeed('ent-1')).not.toBe(hashSeed('ent-2'));
  });
  it('renvoie un entier non signé', () => {
    const h = hashSeed('xyz');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});
