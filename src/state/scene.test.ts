import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, normalizeAmbiance, isIndoor } from './scene';
import { evalCondition } from './flow';
import type { Scene } from './scene';

describe('evalCondition flag — conditions de flag (triggers + dialogues, source unique)', () => {
  const ok = (expr: string, flags: Record<string, boolean>) => evalCondition({ kind: 'flag', expr }, { flags, gameTime: 0 });
  it('flag simple + négation', () => {
    expect(ok('a', { a: true })).toBe(true);
    expect(ok('a', {})).toBe(false);
    expect(ok('!a', {})).toBe(true);
    expect(ok('!a', { a: true })).toBe(false);
  });
  it('flags composés = ET (« v1,!v2 »), pour enchaîner des étapes (ex. vagues d’arène)', () => {
    expect(ok('v1,!v2', { v1: true })).toBe(true); // v1 fait, v2 pas encore
    expect(ok('v1,!v2', { v1: true, v2: true })).toBe(false); // v2 fait → masqué
    expect(ok('v1,!v2', {})).toBe(false); // v1 pas encore
    expect(ok(' v1 , !v2 ', { v1: true })).toBe(true); // tolère les espaces
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
