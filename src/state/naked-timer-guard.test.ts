import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanNakedTimers, SCAN_DIR, ALLOWED } from '../../scripts/guards/lib/nakedTimerScan.mjs';

/**
 * Garde STRUCTURELLE #415 : un `setTimeout`/`setInterval` NU sous `src/state` (hors le wrapper
 * `combatTimers.ts`) est INEXPRIMABLE — tout timer réel qui mute l'état passe par
 * `scheduleCombatTimer`/`scheduleFlowTimer`. Whitelist FIXE, zéro violation tolérée.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIR = join(ROOT, SCAN_DIR);

function scanFiles(): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.[mc]?tsx?$/.test(e.name) && !/\.test\.[mc]?tsx?$/.test(e.name)) out.push({ abs: p, rel: relative(ROOT, p).split('\\').join('/') });
    }
  };
  walk(DIR);
  return out;
}

describe('garde structurelle — setTimeout/setInterval nu sous src/state (#415)', () => {
  it('aucun fichier hors whitelist ne porte de timer nu', () => {
    const offenders: string[] = [];
    for (const { abs, rel } of scanFiles()) {
      if (ALLOWED.includes(rel)) continue;
      const found = scanNakedTimers(readFileSync(abs, 'utf8'));
      for (const f of found) offenders.push(`${rel}:${f.line} ${f.call}(...) nu`);
    }
    expect(
      offenders,
      '`setTimeout`/`setInterval` nu — router par `scheduleCombatTimer`/`scheduleFlowTimer` (src/state/combatTimers.ts) ou, si vraiment légitime, éditer la whitelist ALLOWED (revue).',
    ).toEqual([]);
  });

  it('FAIL-CLOSED : le scanner détecte un appel nu ou global, ignore commentaires/propriété-tierce/type/clear*', () => {
    expect(scanNakedTimers('setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('window.setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('globalThis.setTimeout(fn, 0);')).toHaveLength(1);
    expect(scanNakedTimers('foo.setTimeout(fn, 0);')).toHaveLength(0);
    expect(scanNakedTimers('const t: ReturnType<typeof setTimeout> = x;')).toHaveLength(0);
    expect(scanNakedTimers('// un setTimeout(0) en commentaire')).toHaveLength(0);
    expect(scanNakedTimers('clearTimeout(id);')).toHaveLength(0);
  });
});
