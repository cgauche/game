/**
 * Constructeur d'arme UNIQUE (`engine/items.buildWeapon`) : prouve la convention de Dégâts — le token `BF`
 * est PORTEUR (`effectiveWeaponDamage` teste `/BF/i` pour ajouter le Bonus de Force) — et l'identité
 * byte-à-byte des 4 écritures historiques qu'il remplace. Ancre TDD avant le branchement des 6 sites.
 */
import { describe, it, expect } from 'vitest';
import { buildWeapon, weaponItem } from './items';

describe('buildWeapon — convention de Dégâts (le token BF est porteur)', () => {
  it('SB-relatif → « +BF+N » (naturelles/invoquées/mains nues)', () => {
    expect(buildWeapon({ name: 'Griffe', damage: { plusBF: true, flat: 4 } }).damage).toBe('+BF+4');
  });
  it('Indice de créature (SB déjà inclus) → « +N »', () => {
    expect(buildWeapon({ name: 'Morsure', damage: { plusBF: false, flat: 9 } }).damage).toBe('+9');
  });
  it('« +BF » NU (Tentacule/Piétinement) ≠ « +BF+0 »', () => {
    expect(buildWeapon({ name: 'Tentacule', damage: { plusBF: true, flat: 0, bare: true } }).damage).toBe('+BF');
    expect(buildWeapon({ name: 'X', damage: { plusBF: true, flat: 0 } }).damage).toBe('+BF+0');
  });
  it('Indice négatif → « -2 » (pas « +-2 »)', () => {
    expect(buildWeapon({ name: 'Débile', damage: { plusBF: false, flat: -2 } }).damage).toBe('-2');
  });
  it('literal → verbatim (catalogue)', () => {
    expect(buildWeapon({ name: 'Mains nues', damage: { literal: '+BF+0' } }).damage).toBe('+BF+0');
  });
});

describe('buildWeapon — défauts, uid, copie', () => {
  it('défauts : mêlée, 1 main, qualities vide ; pas d\'uid/reach parasites', () => {
    const w = buildWeapon({ name: 'X', damage: { plusBF: true, flat: 0, bare: true } });
    expect(w).toMatchObject({ type: 'melee', hands: 1, qualities: [] });
    expect(w.uid).toBeUndefined();
    expect(w.reach).toBeUndefined();
  });
  it('uid : littéral conservé ; préfixe → « prefix-it-N » (UN seul newUid)', () => {
    expect(buildWeapon({ name: 'T', damage: { plusBF: true, flat: 0, bare: true }, uid: 'nat-tentacule' }).uid).toBe('nat-tentacule');
    expect(buildWeapon({ name: 'G', damage: { plusBF: true, flat: 3 }, uid: { prefix: 'nat-griffe' } }).uid).toMatch(/^nat-griffe-it-\d+$/);
  });
  it('qualities est COPIÉ (pas aliasé)', () => {
    const src = ['Magique'];
    const w = buildWeapon({ name: 'X', damage: { plusBF: true, flat: 0, bare: true }, qualities: src });
    expect(w.qualities).toEqual(src);
    expect(w.qualities).not.toBe(src);
  });
});

describe('weaponItem — RÉUTILISE buildWeapon, bascule en ItemInstance', () => {
  it('type→kind, ajoute enc/equipped/conjured ; partage la convention de Dégâts et l\'uid', () => {
    const item = weaponItem({ name: 'Arme aethyrique', damage: { plusBF: true, flat: 4 }, qualities: ['Magique'], uid: { prefix: 'conjure' }, conjured: true });
    expect(item).toMatchObject({ kind: 'melee', damage: '+BF+4', qualities: ['Magique'], enc: 0, equipped: false, conjured: true });
    expect(item.uid).toMatch(/^conjure-it-\d+$/);
    expect((item as { type?: unknown }).type).toBeUndefined(); // pas de fuite du champ Weapon.type
  });
});
