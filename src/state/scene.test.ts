import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, elevAt, normalizeAmbiance, isIndoor } from './scene';
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

describe('élévation — décalage vertical sub-niveau par case (scène surélevée / fosse)', () => {
  it('elevAt = 0 par défaut (pas de tableau elev)', () => {
    const s = emptyScene(3, 3);
    expect(elevAt(s, 1, 1)).toBe(0);
  });
  it('elevAt lit Level.elev[y*w+x] (surélévation + contrebas)', () => {
    const s = emptyScene(3, 3);
    s.levels[0].elev = new Array(9).fill(0);
    s.levels[0].elev[1 * 3 + 1] = 0.4; // scène surélevée
    s.levels[0].elev[2 * 3 + 0] = -0.5; // fosse
    expect(elevAt(s, 1, 1)).toBe(0.4);
    expect(elevAt(s, 0, 2)).toBe(-0.5);
    expect(elevAt(s, 0, 0)).toBe(0);
  });
  it('elevAt hors-grille → 0 (pas de débordement)', () => {
    const s = emptyScene(3, 3);
    s.levels[0].elev = new Array(9).fill(0.3);
    expect(elevAt(s, -1, 0)).toBe(0);
    expect(elevAt(s, 3, 0)).toBe(0);
  });
  it('elevAt respecte le niveau z (étage manquant → 0)', () => {
    const s = emptyScene(3, 3);
    s.levels[0].elev = new Array(9).fill(0.2);
    expect(elevAt(s, 1, 1, 0)).toBe(0.2);
    expect(elevAt(s, 1, 1, 5)).toBe(0.2); // repli 1er niveau (comme tileAt)
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
