/**
 * Garde-fou : un renderer d'environnement migré ne porte AUCUN littéral de couleur (identité de
 * matériau). Toute couleur vient du JSON (`src/data/*.json`) ou de `shade.ts`. Forbidder `#hex`/`rgb()`
 * capture aussi les anciennes tables `Record<…>` (hex-valuées). `COVERED` grandit à chaque phase.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const COVERED: string[] = [
  'walls.ts',
  'builders/floors.ts', // builder de sols (pivot) — ne porte que des IDS de matériau, jamais une couleur
  'backends/affineFloors.ts', // backend affine des sols (pov/geometry.ts a encore brouillard/struct-fallback hors phase)
  'RoofSprite.tsx', // Phase 3a (chemin de toit LIVE)
  'catalog/buildings/render-helpers.ts', // Phase 3b (render() mort retiré → ne reste que roofFromCells)
  // Phase 4 → 'sprites.ts'
];

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

/** Retire commentaires (bloc + ligne, en préservant `://`) et imports — on ne teste que le code. */
function stripNoise(src: string): string {
  return src
    .replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i > 0 && l[i - 1] === ':' ? l : i >= 0 ? l.slice(0, i) : l;
    })
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n');
}

function colorHits(src: string): string[] {
  return stripNoise(src)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => COLOR_LITERAL.test(l));
}

describe('garde-fou — aucune couleur en dur dans un renderer migré', () => {
  it('le détecteur mord', () => {
    expect(colorHits('const a = "#5d4c36";')).toHaveLength(1);
    expect(colorHits('fill = `rgba(0,0,0,0.3)`;')).toHaveLength(1);
    expect(colorHits('const c = shade(app.wood.face, SIDE_N);')).toHaveLength(0);
    expect(colorHits('fill="var(--struct-face)"')).toHaveLength(0);
    expect(colorHits('// ancien: #5d4c36')).toHaveLength(0);
  });

  it.each(COVERED)('%s : zéro couleur en dur', (rel) => {
    const hits = colorHits(readFileSync(HERE + rel, 'utf8'));
    expect(hits, `Couleurs en dur dans ${rel} :\n${hits.join('\n')}`).toEqual([]);
  });
});
