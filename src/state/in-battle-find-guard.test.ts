import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanInBattleFind } from '../../scripts/guards/lib/inBattleFind.mjs';

/**
 * Garde-fou « recherche de combattant EN COMBAT par id » (#279, F1 du programme structurel #276).
 * `X.combatants.find((c) => c.id === …)` réinvente `inBattleId(battle, id)`
 * (`src/state/combatOrParty.ts`). Lot 1 a migré ~150 sites de `src/state` (find-par-id EXACT
 * uniquement — les prédicats COMPOSÉS, ex. `c.id === X && c.kind === 'hero'`, ne se réduisent pas
 * à un simple appel de primitive et RESTENT visibles ici, comptés).
 *
 * `combatOrParty.ts` HORS SCAN : c'est le foyer de la primitive, son implémentation EST le motif.
 *
 * MODE CLIQUET (patron `hardcode.mjs`/`combat-hardcode-guard.test.ts`) : `BASELINES` gèle, PAR
 * FICHIER, le nombre de sites tolérés au recensement (2026-07-10, Lot 1 — 3 sites résiduels,
 * prédicats composés). Le test échoue si un fichier DÉPASSE sa baseline (régression : nouveau
 * find-par-id réinventé) OU si une baseline est devenue trop haute (fichier assaini sans
 * abaissement).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/state'];
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rel === 'src/state/combatOrParty.ts';

/** Baseline gelée par fichier (recensement Lot 1, 2026-07-10 — total 3 sites sur 3 fichiers,
 *  tous des prédicats COMPOSÉS non réductibles à `inBattleId` seul). */
const BASELINES: Record<string, number> = {
  'src/state/combat/recover.ts': 1,
  'src/state/combatFlow.ts': 1,
  'src/state/devtools.ts': 1,
};

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
    const n = scanInBattleFind(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « inBattleId » — find-par-id combattant EN COMBAT (cliquet, #279)', () => {
  it('aucun fichier de src/state ne dépasse sa baseline gelée', () => {
    const counts = countsByFile();
    const offenders: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const baseline = BASELINES[rel] ?? 0;
      if (n > baseline) offenders.push(`${rel} : ${n} sites (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      'Nouveau(x) find-par-id réinventé(s) — migrer vers inBattleId(battle, id) ' +
        `(src/state/combatOrParty.ts), ou si prédicat composé légitime AUGMENTER la baseline :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});
