import { describe, it, expect } from 'vitest';
import { hashSeed, composeAppearance, appearanceLayers } from './appearance';
import { CREATURE_APPEARANCES } from './creatureAppearances';
import { enemySprite, entitySprite, creatureNames, pnjSprite, objetSprite, propSprite } from './sprites';
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

describe('composeAppearance', () => {
  // Fixture local : on injecte une créature de test à 1 calque / 3 variantes.
  const KEY = '__TestCreature__';
  CREATURE_APPEARANCES[KEY] = {
    id: KEY,
    layers: [{ slot: 'pose', variants: ['<g id="A"/>', '<g id="B"/>', '<g id="C"/>'] }],
  };

  it('est déterministe pour un même seed', () => {
    expect(composeAppearance(KEY, 123)).toBe(composeAppearance(KEY, 123));
  });
  it('varie selon le seed sur une créature multi-variantes', () => {
    const looks = new Set([0, 1, 2, 3, 4, 5].map((s) => composeAppearance(KEY, s)));
    expect(looks.size).toBeGreaterThan(1);
  });
  it('un pin force la variante choisie', () => {
    expect(composeAppearance(KEY, 999, { pose: 2 })).toBe('<g id="C"/>');
  });
  it('un pin hors bornes est ignoré (retombe sur le tirage)', () => {
    expect(composeAppearance(KEY, 123, { pose: 99 })).toBe(composeAppearance(KEY, 123));
  });
  it('créature non enrichie → null (le fallback est géré par sprites.ts)', () => {
    expect(composeAppearance('CréatureInconnueXYZ', 1)).toBeNull();
  });
  it('appearanceLayers renvoie les calques connus, [] sinon', () => {
    expect(appearanceLayers(KEY).length).toBe(1);
    expect(appearanceLayers('CréatureInconnueXYZ')).toEqual([]);
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
  it('objet → sprite objet non vide', () => {
    expect(entitySprite({ kind: 'objet', id: 'o1' }).length).toBeGreaterThan(0);
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
