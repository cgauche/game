import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCharKeyLegacy } from '../../scripts/guards/lib/charKeyLegacy.mjs';

/**
 * Garde-fou « anciens tokens CharKey en valeur de caractéristique » (#302, pérennise le grep de
 * sortie #311, commit 78d04b4a). `CharKey` = slugs pleins (`capacite-de-combat`…) — plus jamais
 * `'CC'|'CT'|'F'|'E'|'I'|'Ag'|'Dex'|'Int'|'FM'|'Soc'` en VALEUR mécanique (clé de `Characteristics`,
 * champ `char`/`resolveChar`/`testModChar`/`characteristic`). Cible `src/data` + `src/state`
 * (datasets + state) — jamais l'AFFICHAGE (`CHAR_ABR`, dérivé de `characteristics.json` par id).
 *
 * `src/state/charKeyMigration.ts` HORS SCAN : foyer documenté de la migration #311, qui CITE les
 * anciens tokens pour les convertir (pas une régression).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/data/ → ../../ = racine du projet
const SCAN_DIRS = ['src/data', 'src/state'];
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rel === 'src/state/charKeyMigration.ts';

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
    const n = scanCharKeyLegacy(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « CharKey » — anciens tokens courts en valeur (cliquet, #302/#311)', () => {
  it('aucun fichier de src/data ou src/state (hors charKeyMigration.ts) ne réintroduit CC/CT/F/E/I/Ag/Dex/Int/FM/Soc en valeur', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Réapparition d'un ancien token CharKey (#311) — utiliser le slug plein (capacite-de-combat…) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = "const c = { characteristics: { CC: 40, FM: 30 } };";
    expect(scanCharKeyLegacy('src/state/x.ts', regressed).length).toBeGreaterThan(0);
  });

  it('le foyer de migration (hors scan) n\'est pas ré-audité — il ÉNUMÈRE les anciens tokens pour les convertir, pas un usage-valeur', () => {
    const src = readFileSync(join(ROOT, 'src/state/charKeyMigration.ts'), 'utf8');
    expect(EXCLUDED('src/state/charKeyMigration.ts')).toBe(true);
    void src;
  });
});
