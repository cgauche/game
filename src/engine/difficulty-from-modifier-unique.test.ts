import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « export unique `difficultyFromModifier` » (#302). Une seule implémentation autorisée
 * (`src/engine/tests.ts`) — toute 2ᵉ `export function difficultyFromModifier`/`export const
 * difficultyFromModifier` ailleurs est une DUPLICATION du foyer (deux implémentations pouvant diverger
 * silencieusement). Compte d'EXPORTS, pas d'appels.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/engine/ → ../../ = racine du projet
const EXPORT_RX = /export\s+(?:function|const)\s+difficultyFromModifier\b/;

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.[tj]sx?$/.test(e)) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return files;
}

describe('garde-fou « difficultyFromModifier » — export unique (cliquet, #302)', () => {
  it('exactement 1 export de `difficultyFromModifier` dans tout src/', () => {
    const hits: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXPORT_RX.test(readFileSync(f, 'utf8'))) hits.push(rel);
    }
    expect(hits, `Attendu 1 export (src/engine/tests.ts), trouvé :\n${hits.join('\n')}`).toEqual(['src/engine/tests.ts']);
  });
});
