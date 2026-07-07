import { describe, it, expect } from 'vitest';
import { entitySprite, propSprite } from './sprites';
import { creatureSpeciesOptions } from './rig/creatures';

// Le bestiaire ET les PNJ passent par le RIG (pickBackend) ; le backend sprite (entitySprite) ne sert
// que le DÉCOR (props). Tout kind non-prop est routé vers le rig EN AMONT et n'atteint pas entitySprite
// → chaîne vide (jamais un sprite de créature monolithique).
describe('entitySprite — backend sprite = décor uniquement', () => {
  it('prop → sprite décor (propSprite)', () => {
    expect(entitySprite({ kind: 'prop', id: 'd1', ref: 'arbre' })).toBe(propSprite('arbre'));
  });
  it('tout kind non-prop (personnage/ennemi/…) → chaîne vide (rendu géré par le rig en amont)', () => {
    expect(entitySprite({ kind: 'personnage', id: 'c1' })).toBe('');
    expect(entitySprite({ kind: 'personnage', id: 'c2', ref: 'Pigeon' })).toBe('');
    expect(entitySprite({ kind: 'ennemi', id: 'e1', ref: 'Zombie' })).toBe('');
  });
});

describe('creatureSpeciesOptions — source du picker éditeur (defs rig : id + libellé)', () => {
  it('contient des créatures canon variées et > 10 entrées', () => {
    const opts = creatureSpeciesOptions();
    expect(opts.some((o) => o.id === 'skaven' && o.label === 'Skaven')).toBe(true);
    expect(opts.some((o) => o.id === 'loup' && o.label === 'Loup')).toBe(true);
    expect(opts.length).toBeGreaterThan(10);
  });
});
