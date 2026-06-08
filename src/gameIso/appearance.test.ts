import { describe, it, expect } from 'vitest';
import { hashSeed } from './appearance';
import { entitySprite, pnjSprite, propSprite } from './sprites';
import { creatureSpeciesNames } from './rig/creatures';

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

// Le bestiaire passe désormais par le RIG (pickBackend) ; le backend sprite (entitySprite) ne
// sert plus que le DÉCOR (props). Les personnages/pnj sont routés vers le rig EN AMONT et
// n'atteignent pas entitySprite — ils retombent sur le villageois (filet), jamais sur un
// sprite de créature monolithique (supprimé).
describe('entitySprite — backend sprite = décor uniquement', () => {
  it('prop → sprite décor (propSprite)', () => {
    expect(entitySprite({ kind: 'prop', id: 'd1', ref: 'arbre' })).toBe(propSprite('arbre'));
  });
  it('personnage (toute ref) → villageois (rendu créature géré par le rig en amont)', () => {
    expect(entitySprite({ kind: 'personnage', id: 'c1' })).toBe(pnjSprite());
    expect(entitySprite({ kind: 'personnage', id: 'c2', ref: 'Pigeon' })).toBe(pnjSprite());
  });
  it("compat : ancien kind 'pnj' → villageois", () => {
    expect(entitySprite({ kind: 'pnj', id: 'p1' })).toBe(pnjSprite());
    expect(entitySprite({ kind: 'pnj', id: 'p2', ref: 'Villageois' })).toBe(pnjSprite());
  });
  it('kind inconnu (ex. ancien ennemi) → chaîne vide', () => {
    expect(entitySprite({ kind: 'ennemi', id: 'e1', ref: 'Zombie' })).toBe('');
  });
});

describe('creatureSpeciesNames — source du picker éditeur (defs rig)', () => {
  it('contient des créatures canon variées et > 10 entrées', () => {
    const names = creatureSpeciesNames();
    expect(names).toContain('Skaven');
    expect(names).toContain('Loup');
    expect(names.length).toBeGreaterThan(10);
  });
});
