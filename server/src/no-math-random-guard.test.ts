import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanServerMathRandom } from '../../scripts/guards/lib/serverMathRandom.mjs';

/**
 * Garde-fou CWE-338 (verrou P1-1) : ZÉRO `Math.random(` sous `server/src/**` HORS `*.test.*` —
 * `server/src` émet des secrets de partie (token hôte `room.ts`, token de reprise de siège
 * `room.ts`, code de room `index.ts`) ; un PRNG non cryptographique y est un contrôle total de
 * la partie pour qui le devine. La source unique est `secureRandom` (`server/src/rand.ts`,
 * `crypto.getRandomValues`). `roomLogic.ts` reste PUR (`rand` en paramètre) — ses TESTS
 * (`roomLogic.test.ts`) gardent `Math.random` pour le déterminisme, exclus par le filtre `*.test.*`.
 * Zéro cliquet ici (pas de baseline à fondre) : le compte tolérable est 0, point final.
 *
 * Mécanique de détection : `scripts/guards/lib/serverMathRandom.mjs` (module .mjs pur, partagé
 * avec un futur hook pre-commit — patron `hardcode.mjs`/`inBattleFind.mjs`).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // server/src/ → ../../ = racine du projet
const SCAN_DIR = 'server/src';
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel);

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

describe('garde-fou CWE-338 — Math.random interdit sous server/src (secrets de room)', () => {
  it('aucun Math.random( hors *.test.* sous server/src', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      for (const { line, detail } of scanServerMathRandom(rel, readFileSync(f, 'utf8'))) {
        offenders.push(`${rel}:${line} — ${detail}`);
      }
    }
    expect(
      offenders,
      'Math.random( trouvé hors test sous server/src — utiliser secureRandom (server/src/rand.ts) :\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
