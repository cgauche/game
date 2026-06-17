import { describe, it, expect } from 'vitest';
import { statblockToCombatant, sizeFromTraits, entitySize } from './spawn';

describe('sizeFromTraits + dérivation de Taille au spawn (LDB 85)', () => {
  it('parse le trait Taille (insensible accents/casse)', () => {
    expect(sizeFromTraits([{ id: 'taille', arg: 'Énorme' }])).toBe('enorme');
    expect(sizeFromTraits([{ id: 'arme', value: 7, arg: 'Épée' }, { id: 'taille', arg: 'Grande' }])).toBe('grande');
    expect(sizeFromTraits([{ id: 'taille', arg: 'de Petite à Énorme' }])).toBe('enorme'); // plage → borne haute
    expect(sizeFromTraits([{ id: 'arme', value: 5 }])).toBeNull();
  });
  it('statblockToCombatant : Taille dérivée du trait', () => {
    const c = statblockToCombatant({ name: 'Troll', char: { B: 30 }, traits: [{ id: 'taille', arg: 'Grande' }] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('grande');
  });
  it('statblockToCombatant : champ size explicite prioritaire sur le trait', () => {
    const c = statblockToCombatant({ name: 'X', char: {}, size: 'enorme', traits: [{ id: 'taille', arg: 'Grande' }] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('enorme');
  });
  it('statblockToCombatant : défaut Moyenne sans trait ni champ', () => {
    const c = statblockToCombatant({ name: 'X', char: {} }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('moyenne');
  });
  it('wounds.base : sans char.B → formule (woundsForSize) ; avec char.B → surcharge', () => {
    const f = statblockToCombatant({ name: 'X', char: { F: 30, E: 30, FM: 30 } }, 'x', { x: 0, y: 0 });
    expect(f.wounds.max).toBe(12); // 3 + 2·3 + 3 (Moyenne)
    expect(f.wounds.base).toBe(12);
    const o = statblockToCombatant({ name: 'Y', char: { F: 30, E: 30, FM: 30, B: 50 } }, 'y', { x: 0, y: 0 });
    expect(o.wounds.max).toBe(50); // surcharge
    expect(o.wounds.base).toBe(50);
  });
});

describe('entitySize — Taille d’une entité posée (rendu éditeur/exploration)', () => {
  it('champ explicite du statbloc prioritaire', () => {
    expect(entitySize({ statblock: { name: 'X', char: {}, size: 'enorme' } })).toBe('enorme');
  });
  it('sinon dérivée des Traits du statbloc', () => {
    expect(entitySize({ statblock: { name: 'X', char: {}, traits: [{ id: 'taille', arg: 'Grande' }] } })).toBe('grande');
  });
  it('aucune info → undefined (⇒ Moyenne au rendu)', () => {
    expect(entitySize({})).toBeUndefined();
    expect(entitySize({ statblock: { name: 'X', char: {} } })).toBeUndefined();
  });
});
