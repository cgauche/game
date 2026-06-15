import { describe, it, expect } from 'vitest';
import { parseAsciiRows, parseWalledAscii } from './asciiMap';

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
});
