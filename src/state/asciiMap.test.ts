import { describe, it, expect } from 'vitest';
import { parseAsciiRows, parseWalledAscii, scanMarkers } from './asciiMap';

describe('parseAsciiRows', () => {
  it('mappe les chars → terrains, `.`/espace = base', () => {
    const { w, h, tiles } = parseAsciiRows(['#M.', 'M M'], 'marbre', { M: 'marbre' });
    expect({ w, h }).toEqual({ w: 3, h: 2 });
    expect(tiles).toEqual(['mur', 'marbre', 'marbre', 'marbre', 'marbre', 'marbre']);
  });

  it('lève sur une ligne de largeur incohérente', () => {
    expect(() => parseAsciiRows(['###', '##'], 'mur')).toThrow(/largeur/);
  });

  it('lève sur un char inconnu', () => {
    expect(() => parseAsciiRows(['#?#'], 'mur')).toThrow(/inconnu/);
  });
});

describe('parseWalledAscii (box-drawing : tuiles + murs sur arêtes)', () => {
  // 2×1 cases : A (sol) | B (eau), mur plein entre A et B, portes au-dessus de A et en bas de B.
  const rows = [
    '+:+-+',
    '|A|B|',
    '+-+:+',
  ];
  const out = parseWalledAscii(rows, 'sol', { A: 'sol', B: 'eau' });

  it('lit les tuiles (slots impairs) via la légende', () => {
    expect({ w: out.w, h: out.h }).toEqual({ w: 2, h: 1 });
    expect(out.tiles).toEqual(['sol', 'eau']);
  });

  it('lit le mur INTERNE entre A et B (arête E de (0,0))', () => {
    expect(out.walls).toContainEqual({ x: 0, y: 0, side: 'E' });
  });

  it('lit les PORTES (`:`) au bon endroit', () => {
    expect(out.walls).toContainEqual({ x: 0, y: 0, side: 'N', door: true }); // au-dessus de A
    expect(out.walls).toContainEqual({ x: 1, y: 1, side: 'N', door: true }); // bord bas sous B (S de (1,0) = N de (1,1))
  });

  it('lève sur une grille de dimensions paires', () => {
    expect(() => parseWalledAscii(['+-+', '|A|'], 'sol')).toThrow(/2W\+1|2H\+1|attendue/);
  });

  it('pose une STRUCTURE sur l\'arête via opts.structures (herse dans le mur)', () => {
    // 2×1 cases A | B ; arête E de (0,0) = herse `H` (mur + structure `porte-de-ville`).
    const built = parseWalledAscii(['+-+-+', '|AHB|', '+-+-+'], 'sol', { A: 'sol', B: 'eau' }, { structures: { H: 'porte-de-ville' } });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'E', structure: 'porte-de-ville' });
    expect(built.tiles).toEqual(['sol', 'eau']);
  });

  it('structure sur une arête PORTE (`:`) cumule door + structure', () => {
    const built = parseWalledAscii(['+:+', '|A|', '+-+'], 'sol', { A: 'sol' }, { structures: { ':': 'herse' } });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'N', door: true, structure: 'herse' });
  });

  it('lit la FENÊTRE (`o`) comme un mur qui porte window:true (#779)', () => {
    const built = parseWalledAscii(['+o+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' });
    expect(built.walls).toContainEqual({ x: 0, y: 0, side: 'N', window: true });
  });

  it('sans opts.structures : comportement byte-identique (non-régression)', () => {
    const a = parseWalledAscii(['+:+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' });
    const b = parseWalledAscii(['+:+-+', '|A|B|', '+-+:+'], 'sol', { A: 'sol', B: 'eau' }, {});
    expect(a).toEqual(b);
    expect(a.walls).toContainEqual({ x: 0, y: 0, side: 'E' }); // mur nu, aucune clé structure
  });
});

describe('scanMarkers', () => {
  it('renvoie positions des marqueurs + lignes nettoyées (marqueurs → `.`)', () => {
    const { positions, cleaned } = scanMarkers(['.@.', 'X.@'], '@X');
    expect(positions['@']).toEqual([{ x: 1, y: 0 }, { x: 2, y: 1 }]);
    expect(positions['X']).toEqual([{ x: 0, y: 1 }]);
    expect(cleaned).toEqual(['...', '...']);
  });

  it('n\'altère pas les chars non-marqueurs', () => {
    const { positions, cleaned } = scanMarkers(['#@#', '~.~'], '@');
    expect(cleaned).toEqual(['#.#', '~.~']);
    expect(positions['@']).toEqual([{ x: 1, y: 0 }]);
  });

  it('clé par marqueur même absent (→ [])', () => {
    const { positions } = scanMarkers(['...'], '@X');
    expect(positions).toEqual({ '@': [], X: [] });
  });
});
