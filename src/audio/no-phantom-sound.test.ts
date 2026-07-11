import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { soundRefsIn } from '../../scripts/guards/lib/soundRefs.mjs';
import { SOUND_DEFS } from './_registry.generated';

/**
 * Garde-fou anti-son-fantôme (#321 lentille 2) : `playSfx(id: string)` (src/audio/engine.ts) est
 * une frontière NON compilée (id littéral, `byId.get(id)` absorbe silencieusement un id inconnu —
 * pas de son joué, aucune erreur). Toute réf littérale `playSfx('...')` de `src/**` (hors tests —
 * ids de fixture forgés) doit résoudre dans le registre (`src/audio/_registry.generated.ts`,
 * régénéré par `npm run gen`). Mécanique d'extraction JUMELLE de `no-phantom-icon.test.ts` :
 * `scripts/guards/lib/soundRefs.mjs`.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const IDS = new Set(SOUND_DEFS.map((d) => d.id));

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.[tj]sx?$/.test(e)) out.push(p);
  }
}

describe('garde-fou anti-son-fantôme (réfs playSfx → registre de sons)', () => {
  it('toute réf `playSfx(\'...\')` de src/** résout dans le registre', () => {
    const files: string[] = [];
    walk(join(ROOT, 'src'), files);
    const offenders: string[] = [];
    let scanned = 0;
    for (const f of files) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const refs = soundRefsIn(readFileSync(f, 'utf8'));
      for (const { id, line } of refs) {
        scanned++;
        if (!IDS.has(id)) offenders.push(`${rel}:${line} → son inconnu « ${id} »`);
      }
    }
    expect(scanned, 'la garde doit scanner AU MOINS un id — sinon elle est morte').toBeGreaterThan(0);
    expect(
      offenders,
      'Son fantôme détecté — déposer une def dans src/audio/defs/ puis `npm run gen`',
    ).toEqual([]);
  });
});
