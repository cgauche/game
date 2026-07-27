import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('src/engine/qualities/qualityId.generated.ts — GÉNÉRÉ à jour', () => {
  it('régénéré en mémoire == committé (sinon : npm run gen:quality-ids)', () => {
    const out = execFileSync('node', ['scripts/gen-quality-ids.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    expect(out).toMatch(/^gen:quality-ids — OK/);
  });
});
