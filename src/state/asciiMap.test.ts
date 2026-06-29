import { describe, it, expect } from 'vitest';
import { parseAsciiRows, parseWalledAscii, scanMarkers, parseLevels } from './asciiMap';

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

describe('parseLevels (assemblage multi-étages)', () => {
  // z0 : enceinte 4×3 avec un escalier `E` en (1,2) et une entité `@` ; z1 : chemin de ronde avec
  // l'escalier `E` aligné en (1,2) + une sentinelle `S`.
  const Z0 = ['####', '#E@#', '#E.#'];
  const Z1 = ['.E..', '.E.S', '....'];
  const out = parseLevels(
    [
      { z: 0, rows: Z0, base: 'mur' },
      { z: 1, rows: Z1, base: 'vide' },
    ],
    { markers: '@S', stair: 'E', stairBase: 'plancher' },
  );

  it('même w×h, terrain parsé après nettoyage des marqueurs', () => {
    expect({ w: out.w, h: out.h }).toEqual({ w: 4, h: 3 });
    // (2,1) portait `@` (marqueur) → nettoyé en base 'mur' de z0.
    expect(out.levels[0].tiles[1 * 4 + 2]).toBe('mur');
    // escalier (1,2) z0 → case marchable stairBase.
    expect(out.levels[0].tiles[2 * 4 + 1]).toBe('plancher');
    // z1 base = 'vide', case d'escalier (1,0) → stairBase.
    expect(out.levels[1].tiles[0 * 4 + 1]).toBe('plancher');
  });

  it('positions des marqueurs ressortent AVEC z (tous étages)', () => {
    expect(out.markers['@']).toEqual([{ x: 2, y: 1, z: 0 }]);
    expect(out.markers['S']).toEqual([{ x: 3, y: 1, z: 1 }]);
    // l'escalier est un marqueur comme un autre → ses positions aussi indexées avec z.
    expect(out.markers['E']).toEqual([
      { x: 1, y: 1, z: 0 }, { x: 1, y: 2, z: 0 },
      { x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 },
    ]);
  });

  it('auto-stairs : char d\'escalier commun z0↔z1 → lien MONTANT (z explicite, compatible Scene.stairs)', () => {
    // case (1,1) porte `E` sur z0 ET z1 → un escalier montant ; (1,2) seulement sur z0, (1,0) seulement
    // sur z1 → pas de lien. Seul le sens montant est émis. Le z est EXPLICITE (un escalier relie deux étages précis).
    expect(out.stairs).toEqual([{ from: { x: 1, y: 1, z: 0 }, to: { x: 1, y: 1, z: 1 } }]);
  });

  it('lève si un étage diffère en largeur (garde d\'authoring)', () => {
    expect(() => parseLevels([
      { z: 0, rows: ['####', '####'], base: 'mur' },
      { z: 1, rows: ['###', '###'], base: 'vide' },
    ])).toThrow(/niveaux|≠/);
  });
});
