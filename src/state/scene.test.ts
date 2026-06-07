import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, normalizeEntityKind, normalizeAmbiance, isIndoor } from './scene';
import type { Scene } from './scene';

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
  it('mappe les anciennes valeurs (pnj/ennemi → personnage, objet → prop)', () => {
    expect(normalizeEntityKind('pnj')).toBe('personnage');
    expect(normalizeEntityKind('ennemi')).toBe('personnage');
    expect(normalizeEntityKind('objet')).toBe('prop'); // dissous dans prop (décor interactif)
  });
  it('conserve les kinds canoniques', () => {
    expect(normalizeEntityKind('personnage')).toBe('personnage');
    expect(normalizeEntityKind('heroStart')).toBe('heroStart');
    expect(normalizeEntityKind('prop')).toBe('prop');
  });
  it('valeur inconnue → personnage (défaut sûr)', () => {
    expect(normalizeEntityKind('zzz')).toBe('personnage');
  });
});

describe('ambiance — intérieur vs extérieur (jour/nuit vient de l’horloge, #T1c)', () => {
  it('normalizeAmbiance : interieur conservé ; jour/nuit/foret/undefined → exterieur', () => {
    expect(normalizeAmbiance('interieur')).toBe('interieur');
    expect(normalizeAmbiance('exterieur')).toBe('exterieur');
    expect(normalizeAmbiance('jour')).toBe('exterieur');
    expect(normalizeAmbiance('nuit')).toBe('exterieur');
    expect(normalizeAmbiance('foret')).toBe('exterieur');
    expect(normalizeAmbiance(undefined)).toBe('exterieur');
  });
  it('isIndoor', () => {
    expect(isIndoor({ ambiance: 'interieur' } as Scene)).toBe(true);
    expect(isIndoor({ ambiance: 'nuit' } as Scene)).toBe(false);
    expect(isIndoor({ ambiance: undefined } as Scene)).toBe(false);
  });
});
