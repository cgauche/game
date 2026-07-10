import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde bloquante #286 : `<datalist` interdit sous `src/ui/editor/**` — les 4 sites historiques
 * (props/décors, traits, sorts, talents) sont migrés `RefField` (`src/ui/compendium/RefField.tsx`,
 * seul propriétaire du motif `<input list>`/`<datalist>`). Un `<datalist>` réintroduit dans l'éditeur
 * est une réinvention du picker de référence unifié.
 */

const EDITOR = fileURLToPath(new URL('.', import.meta.url)); // src/ui/editor/

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) acc.push(p);
  }
  return acc;
}

describe('#286 — <datalist> interdit sous src/ui/editor (RefField = seul picker de réf)', () => {
  it('aucun <datalist dans src/ui/editor/**', () => {
    const offenders: string[] = [];
    for (const f of walk(EDITOR)) {
      const src = readFileSync(f, 'utf8');
      if (/<datalist\b/.test(src)) offenders.push(f.slice(EDITOR.length).split('\\').join('/'));
    }
    expect(offenders, '<datalist> hand-rollé sous src/ui/editor — composer <RefField> (src/ui/compendium/RefField.tsx) :\n' + offenders.join('\n')).toEqual([]);
  });
});
