import { describe, it, expect } from 'vitest';
import { parseAsciiRows } from './asciiMap';

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
