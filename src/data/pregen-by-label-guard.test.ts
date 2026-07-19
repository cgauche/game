import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPregenByLabel } from '../../scripts/guards/lib/pregenByLabel.mjs';
import pregens from './pregens.json';

/**
 * Garde-fou « prégénéré retrouvé PAR LABEL » (#322) : un test ne retrouve JAMAIS un `PregenDef`
 * (`pregens.json`) via `.find(… => x.name === '<nom affiché>')`/`.name.startsWith('<préfixe>')` — le
 * label est de l'AFFICHAGE (CLAUDE.md, doctrine ids), fragile à tout renommage. La source unique est
 * `pregen(PREGEN.<clé>)` / `pregenParty(...)` (`src/data/pregens.ts`), résolution par id STABLE
 * (`pregen-<seed>`) qui JETTE explicitement si absent. ZÉRO TOLÉRANCE (pas de baseline cliquet) :
 * la migration (#322) a ramené le compte à 0 sur les 42 sites recensés (16 fichiers `src/state` +
 * 1 scénario) ; tout nouveau site réintroduit régresse.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/data/ → ../../ = racine du projet
const NAMES = (pregens as { label: string }[]).map((p) => p.label);

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return files;
}

describe('garde-fou « prégénéré par label » (#322)', () => {
  it('aucun test ne recherche un prégénéré via .name/.label === <libellé> — utiliser pregen(PREGEN.x)/pregenParty(...)', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const findings = scanPregenByLabel(rel, readFileSync(f, 'utf8'), NAMES);
      for (const fi of findings) offenders.push(`${rel}:${fi.line} : ${fi.detail}`);
    }
    expect(
      offenders,
      'Prégénéré(s) retrouvé(s) par LABEL — migrer vers pregen(PREGEN.<clé>)/pregenParty(...) ' +
        `(src/data/pregens.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : détecte un motif fictif de lookup par label (preuve TDD)', () => {
    const fake = "const w = pregens.find((p) => p.name === 'Wilhelmina Faust');";
    expect(scanPregenByLabel('fake.test.ts', fake, NAMES)).toHaveLength(1);
    const fakeStartsWith = "const w = party.find((h) => h.name.startsWith('Klein'));";
    expect(scanPregenByLabel('fake.test.ts', fakeStartsWith, NAMES)).toHaveLength(1);
    const legit = "const w = pregen(PREGEN.sorcier);";
    expect(scanPregenByLabel('fake.test.ts', legit, NAMES)).toHaveLength(0);
  });
});
