import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSortByZInline, SORT_BY_Z_WHITELIST } from '../../../scripts/guards/lib/sortByZInline.mjs';

/**
 * Garde-fou « tri z inline hors composeur canonique » (#302). `sortByZ` (`src/gameIso/rig/composite.ts`)
 * est la SOURCE UNIQUE du tri peintre intra-corps pour tout `compose*` non-bipède — `.sort((a,b) =>
 * a.z - b.z)` recopié ailleurs réinvente le foyer. BASELINE ZÉRO hors les 2 sites légitimes déjà
 * connus (WHITELIST, quarantaine d'IMPORT plutôt que grep large) : `composite.ts` (le foyer) et
 * `composeRig.tsx` (le composeur BIPÈDE, motif structurellement distinct — cf. sa docstring).
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url)); // src/gameIso/rig/ → ../../../ = racine
const SCAN_DIRS = ['src/gameIso/rig'];
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || SORT_BY_Z_WHITELIST.includes(rel);

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return files;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of scanFiles()) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const n = scanSortByZInline(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « sortByZ » — tri z inline hors composeur canonique (cliquet, #302)', () => {
  it('aucun compose* de src/gameIso/rig (hors whitelist) ne recopie `.sort((a,b) => a.z - b.z)`', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouveau tri z inline — router par sortByZ (src/gameIso/rig/composite.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = 'return bones.sort((a, b) => a.z - b.z);';
    expect(scanSortByZInline('src/gameIso/rig/amorphous/composeHulk.ts', regressed).length).toBe(1);
  });

  it('les 2 sites whitelistés (hors scan) portent bien le motif — sinon la whitelist a bougé', () => {
    for (const rel of SORT_BY_Z_WHITELIST) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const raw = src.split('\n').some((l) => /\.sort\(\([^)]*\)\s*=>\s*[^)]*\.z\s*-\s*[^)]*\.z\)/.test(l));
      expect(raw, rel).toBe(true);
    }
  });
});
