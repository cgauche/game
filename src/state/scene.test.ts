import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, normalizeAmbiance, isIndoor, condMet } from './scene';
import type { Scene } from './scene';

describe('condMet — conditions de flag (triggers + dialogues, source unique)', () => {
  it('flag simple + négation', () => {
    expect(condMet('a', { a: true })).toBe(true);
    expect(condMet('a', {})).toBe(false);
    expect(condMet('!a', {})).toBe(true);
    expect(condMet('!a', { a: true })).toBe(false);
  });
  it('flags composés = ET (« v1,!v2 »), pour enchaîner des étapes (ex. vagues d’arène)', () => {
    expect(condMet('v1,!v2', { v1: true })).toBe(true); // v1 fait, v2 pas encore
    expect(condMet('v1,!v2', { v1: true, v2: true })).toBe(false); // v2 fait → masqué
    expect(condMet('v1,!v2', {})).toBe(false); // v1 pas encore
    expect(condMet(' v1 , !v2 ', { v1: true })).toBe(true); // tolère les espaces
  });
});

describe('scene + terrain registre', () => {
  it('isWalkable suit le registre terrain', () => {
    const s = emptyScene(3, 3); // rempli d'herbe
    s.levels[0].tiles[0] = 'pave';
    s.levels[0].tiles[1] = 'eau';
    expect(isWalkable(s, 0, 0)).toBe(true); // pave
    expect(isWalkable(s, 1, 0)).toBe(false); // eau
  });
  it('hors-grille → mur (bloqué)', () => {
    const s = emptyScene(3, 3);
    expect(tileAt(s, -1, 0)).toBe('mur');
    expect(isWalkable(s, -1, 0)).toBe(false);
  });
});

describe('ambiance — intérieur vs extérieur (jour/nuit vient de l’horloge, #T1c)', () => {
  it('normalizeAmbiance : interieur conservé ; exterieur/undefined → exterieur', () => {
    expect(normalizeAmbiance('interieur')).toBe('interieur');
    expect(normalizeAmbiance('exterieur')).toBe('exterieur');
    expect(normalizeAmbiance(undefined)).toBe('exterieur');
  });
  it('isIndoor', () => {
    expect(isIndoor({ ambiance: 'interieur' } as Scene)).toBe(true);
    expect(isIndoor({ ambiance: 'exterieur' } as Scene)).toBe(false);
    expect(isIndoor({ ambiance: undefined } as Scene)).toBe(false);
  });
});
