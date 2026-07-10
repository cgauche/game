import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasInlineSourceRef } from '../../scripts/guards/lib/sourceRefInline.mjs';

/**
 * Garde-fou « réf de source `{book,page}` réinventée » (#281, F20/V10 du programme structurel
 * #276). `z.strictObject({ book: z.string(), page: z.number() })` réinvente `sourceRefSchema`
 * (`src/data/schemas/common.ts:23`) — importer `sourceRefSchema` à la place. Tolérance ZÉRO
 * (bloquant) : le Lot 3 a migré les 4 seules defs qui la réinventaient.
 *
 * `common.ts` HORS SCAN : c'est le foyer de la primitive, sa définition EST le motif.
 * `structures.ts` (`{book,chapter}`, divergence DOCUMENTÉE sans `page`) ne matche pas ce motif —
 * pas d'exclusion nécessaire.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/data/ → ../../ = racine du projet
const SCAN_DIR = 'src/data/schemas';
const EXCLUDED = (rel: string) => rel === 'src/data/schemas/common.ts';

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  walk(join(ROOT, SCAN_DIR));
  return files;
}

describe('garde-fou « sourceRefSchema » — réf de source `{book,page}` réinventée (#281)', () => {
  it('aucune def zod hors common.ts ne réinvente `{book:string, page:number}`', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      if (hasInlineSourceRef(rel, readFileSync(f, 'utf8'))) offenders.push(rel);
    }
    expect(
      offenders,
      `Réf de source {book,page} réinventée inline — importer sourceRefSchema (src/data/schemas/common.ts:23) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
