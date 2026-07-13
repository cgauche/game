import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde bloquante #286 : `<datalist>` hand-rollé interdit dans l'UI — `RefField`
 * (`src/ui/compendium/RefField.tsx`) est le SEUL propriétaire du motif `<input list>`/`<datalist>`
 * (picker de référence unifié). Un `<datalist>` réinventé ailleurs double le picker.
 *
 * PÉRIMÈTRE ÉTENDU #410 (2026-07-13) : la garde balaie désormais TOUT `src/ui` (walk récursif) au
 * lieu du seul `src/ui/editor` — l'audit de couverture a trouvé le motif réinventé dans
 * `src/ui/compendium` (StructFields, CodexEdit), hors du dossier jadis surveillé.
 *
 * `RefField.tsx` HORS SCAN : c'est le foyer de la primitive, son implémentation EST le motif.
 *
 * BASELINE gelée (surface d'ATELIER DEV) : `CodexEdit`/`StructFields` sont l'éditeur de fiches du
 * Compendium (surface développeur, hors jeu joué) ; leur `<datalist>` pioche par LIBELLÉ car
 * plusieurs fiches partagent un même libellé (cf. `CodexEdit.tsx`), là où `RefField` pioche par id.
 * Ce stock reste GELÉ et VISIBLE au cliquet : toute HAUSSE échoue, toute BAISSE abaisse la baseline.
 */

const UI = fileURLToPath(new URL('..', import.meta.url)); // src/ui/editor/ → src/ui/
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)); // racine du repo

const EXCLUDED = (rel: string) => rel === 'src/ui/compendium/RefField.tsx';

/** Stock GELÉ de datalist en surface d'atelier DEV (#410, 2026-07-13). */
const BASELINE: Record<string, number> = {
  'src/ui/compendium/CodexEdit.tsx': 1,
  'src/ui/compendium/StructFields.tsx': 2,
};

/** Retire commentaires ligne/bloc (les JSDoc de RefField/CodexEdit CITENT `<datalist>` en prose). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/');
        if (EXCLUDED(rel)) continue;
        const n = (stripComments(readFileSync(p, 'utf8')).match(/<datalist\b/g) ?? []).length;
        if (n > 0) counts[rel] = n;
      }
    }
  };
  walk(UI);
  return counts;
}

describe('#286/#410 — <datalist> interdit dans src/ui (RefField = seul picker de réf)', () => {
  it('aucun fichier de src/ui ne dépasse sa baseline gelée de <datalist>', () => {
    const counts = countsByFile();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} <datalist> (baseline gelée ${b})`);
    }
    expect(
      over,
      '<datalist> hand-rollé — composer <RefField> (src/ui/compendium/RefField.tsx) :\n' + over.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (site purgé) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINE').toEqual([]);
  });
});
