import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconRefsIn } from '../../scripts/guards/lib/iconRefs.mjs';
import { ICON_DEFS } from './icons';

/**
 * Garde-fou anti-icône-fantôme (#269) : une réf d'icône `icon: '...'`/`"icon": "..."` posée en
 * DONNÉE (`src/state/**`, `src/scenes/**`, `src/data/*.json`) porte le type large `IconIdInput`
 * (`src/ui/icons/types.ts`) — pas l'union `IconId` GÉNÉRÉE qui verrouille `src/ui/**` à la
 * compilation. Une réf inconnue n'y throw QU'AU RENDU (DEV), absorbée en silence par
 * `SceneErrorBoundary` — c'est ce trou que ce test de BUILD ferme : toute réf littérale hors du
 * registre (`src/ui/icons/_registry.generated.ts`, régénéré par `npm run gen`) fait échouer la suite.
 * Mécanique d'extraction (regex `icon:`/`"icon":`, dédup, ligne de 1ʳᵉ occurrence) :
 * `scripts/guards/lib/iconRefs.mjs` (module .mjs pur).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // racine du projet (src/ui/ → ../../)
const SCAN_DIRS = ['src/state', 'src/scenes'];

/** `*.test.*` exclus : les tests portent parfois des ids de fixture forgés (pas rendus à
 *  l'utilisateur, pas des affordances réelles). */
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel);

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
}

function scanFiles(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
  for (const e of readdirSync(join(ROOT, 'src/data'))) {
    if (e.endsWith('.json')) files.push(join(ROOT, 'src/data', e));
  }
  return files;
}

describe('garde-fou anti-icône-fantôme (réfs de donnée → registre d’icônes)', () => {
  it('toute réf `icon:`/`"icon":` de src/state, src/scenes et src/data/*.json résout dans le registre', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      const refs = iconRefsIn(readFileSync(f, 'utf8'));
      for (const { id, line } of refs) {
        scanned++;
        if (!ICON_DEFS[id]) offenders.push(`${rel}:${line} → icône inconnue « ${id} »`);
      }
    }
    expect(scanned, 'la garde doit scanner AU MOINS un id — sinon elle est morte').toBeGreaterThan(0);
    expect(
      offenders,
      'Icône fantôme détectée — déposer une def dans src/ui/icons/defs/ puis `npm run gen`',
    ).toEqual([]);
  });
});
