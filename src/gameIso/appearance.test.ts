import { describe, it, expect } from 'vitest';
import { hashSeed } from './appearance';
import { enemySprite, entitySprite, creatureNames, pnjSprite, propSprite } from './sprites';
import creatureSprites from './creatureSprites.json';

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

describe('enemySprite — fallback monolithique', () => {
  it('rend exactement le sprite JSON pour une créature non enrichie', () => {
    const json = (creatureSprites as Record<string, string>)['Zombie'];
    expect(enemySprite('Zombie')).toBe(json);
  });
  it('label vide → un sprite non vide (mutantStand)', () => {
    expect(enemySprite('').length).toBeGreaterThan(0);
  });
  it('label inconnu → un sprite non vide (mutantStand)', () => {
    expect(enemySprite('PasUneCréature').length).toBeGreaterThan(0);
  });
});

describe('entitySprite — apparence découplée du rôle', () => {
  it('pnj sans ref → villageois (pnjSprite)', () => {
    expect(entitySprite({ kind: 'pnj', id: 'p1' })).toBe(pnjSprite());
  });
  it("pnj avec ref 'Villageois' → villageois", () => {
    expect(entitySprite({ kind: 'pnj', id: 'p2', ref: 'Villageois' })).toBe(pnjSprite());
  });
  it("pnj avec ref 'Pigeon' → apparence pigeon (n'importe quelle créature)", () => {
    const pigeon = (creatureSprites as Record<string, string>)['Pigeon'];
    expect(entitySprite({ kind: 'pnj', id: 'p3', ref: 'Pigeon' })).toBe(pigeon);
  });
  it("ennemi avec ref 'Zombie' → sprite bestiaire", () => {
    const zombie = (creatureSprites as Record<string, string>)['Zombie'];
    expect(entitySprite({ kind: 'ennemi', id: 'e1', ref: 'Zombie' })).toBe(zombie);
  });
  it("prop → sprite décor non vide", () => {
    expect(entitySprite({ kind: 'prop', id: 'd1', ref: 'arbre' })).toBe(propSprite('arbre'));
  });
  it('creatureNames inclut des créatures variées du bestiaire', () => {
    const names = creatureNames();
    expect(names).toContain('Pigeon');
    expect(names).toContain('Zombie');
    expect(names.length).toBeGreaterThan(10);
  });
});

describe('entitySprite — kind unifié personnage', () => {
  it('personnage sans ref → villageois', () => {
    expect(entitySprite({ kind: 'personnage', id: 'c1' })).toBe(pnjSprite());
  });
  it("personnage avec ref 'Pigeon' → apparence pigeon", () => {
    const pigeon = (creatureSprites as Record<string, string>)['Pigeon'];
    expect(entitySprite({ kind: 'personnage', id: 'c2', ref: 'Pigeon' })).toBe(pigeon);
  });
  it("compat : ancien kind 'pnj' rend toujours (villageois sans ref)", () => {
    expect(entitySprite({ kind: 'pnj', id: 'c3' })).toBe(pnjSprite());
  });
  it("compat : ancien kind 'ennemi' rend toujours (bestiaire via ref)", () => {
    const zombie = (creatureSprites as Record<string, string>)['Zombie'];
    expect(entitySprite({ kind: 'ennemi', id: 'c4', ref: 'Zombie' })).toBe(zombie);
  });
});
