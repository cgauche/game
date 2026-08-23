/**
 * `chebyshev` : la métrique de distance de la grille, et SA SOURCE UNIQUE (#1440).
 *
 * Deux copies privées vivaient à côté du canon (`engine/scatter`, `state/vision`) : trois définitions
 * pour une seule règle de mesure, donc trois chances de diverger. Le canon est ici, dans le MOTEUR
 * (règle 3 : `src/engine` ne dépend pas de `src/state`), et le scan AST ci-dessous refuse toute
 * seconde définition dans `src/` — quel que soit son emballage (fonction, const-fonction, propriété).
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { tsSources, scanDefinitions } from '../../scripts/guards/lib/canonUnique.mjs';
import { chebyshev } from './grid';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('grille — distance de Chebyshev (#1440)', () => {
  it('la diagonale vaut 1, la métrique est le max des deltas', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(chebyshev({ x: 2, y: 7 }, { x: 2, y: 7 })).toBe(0);
    expect(chebyshev({ x: 5, y: 0 }, { x: 0, y: 4 })).toBe(5);
  });

  it('est symétrique et jamais négative', () => {
    expect(chebyshev({ x: -3, y: 2 }, { x: 4, y: -6 })).toBe(chebyshev({ x: 4, y: -6 }, { x: -3, y: 2 }));
    expect(chebyshev({ x: -3, y: 2 }, { x: 4, y: -6 })).toBe(8);
  });

  it('n’a QU’UNE définition dans `src/` — les autres modules l’importent', () => {
    const defs = tsSources(ROOT, ['src']).flatMap(({ rel, code }) => scanDefinitions(rel, code, 'chebyshev').map((f) => `${rel}:${f.line} — ${f.detail}`));
    expect(defs.map((d) => d.split(':')[0]), 'importer `chebyshev` de `engine/grid` (#1440)').toEqual(['src/engine/grid.ts']);
  });
});
