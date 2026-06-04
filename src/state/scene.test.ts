import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, normalizeEntityKind } from './scene';

describe('scene + terrain registre', () => {
  it('isWalkable suit le registre terrain', () => {
    const s = emptyScene(3, 3); // rempli d'herbe
    s.tiles[0] = 'pave';
    s.tiles[1] = 'eau';
    expect(isWalkable(s, 0, 0)).toBe(true); // pave
    expect(isWalkable(s, 1, 0)).toBe(false); // eau
  });
  it('hors-grille → mur (bloqué)', () => {
    const s = emptyScene(3, 3);
    expect(tileAt(s, -1, 0)).toBe('mur');
    expect(isWalkable(s, -1, 0)).toBe(false);
  });
});

describe('normalizeEntityKind — compat fusion pnj/ennemi', () => {
  it('mappe les anciennes valeurs vers personnage', () => {
    expect(normalizeEntityKind('pnj')).toBe('personnage');
    expect(normalizeEntityKind('ennemi')).toBe('personnage');
  });
  it('conserve les kinds canoniques', () => {
    expect(normalizeEntityKind('personnage')).toBe('personnage');
    expect(normalizeEntityKind('heroStart')).toBe('heroStart');
    expect(normalizeEntityKind('objet')).toBe('objet');
    expect(normalizeEntityKind('prop')).toBe('prop');
  });
  it('valeur inconnue → personnage (défaut sûr)', () => {
    expect(normalizeEntityKind('zzz')).toBe('personnage');
  });
});
