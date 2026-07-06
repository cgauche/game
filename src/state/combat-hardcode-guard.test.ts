import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanHardcode } from '../../scripts/guards/lib/hardcode.mjs';

/**
 * Garde-fou « tout migrer » — chantier d'unification des événements/réactions de combat.
 * (cf. docs/combat-events-coherence.md — Recensement Lot 0.)
 *
 * Compte les SITES RÉACTIFS codés PAR-NOM (trait/talent) dans TOUT `src/engine` + `src/state`
 * (récursif, `.ts`/`.tsx`, HORS `*.test.*`) : une réaction de combat (pénalité, dégâts par round,
 * bonus, Riposte, Cleave, infection, contenu de trait/talent caché dans un hook…) doit devenir de
 * la DONNÉE (`TriggeredEffect`/`passive`), pas une branche impérative nommant l'entité.
 *
 * MODE CLIQUET (Lot 8 — généralisation du report-only Lot 0/4bis/6, qui ne portait que sur 3
 * fichiers nommés) : `BASELINES` gèle, PAR FICHIER, le nombre de sites tolérés au recensement.
 * Le test échoue si un fichier DÉPASSE sa baseline (= nouveau hardcode = régression) OU si une
 * baseline est devenue trop haute (fichier assaini sans qu'elle soit abaissée — patron repris de
 * `no-emoji-affordance.test.ts` CLIQUET, lignes 100-111). Un fichier absent de `BASELINES` a une
 * baseline 0 implicite : `engine/conditions.ts`, `state/combat/roundHooks.ts`,
 * `state/combatFlow.ts` (les 3 cibles historiques du Lot 0, migrées aux Lots 4/4bis/6) y restent.
 *
 * Mécanique de détection (marqueurs réactifs par-nom, exclusion des imports) :
 * `scripts/guards/lib/hardcode.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/engine', 'src/state'];
const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel);

/** Baseline gelée par fichier (recensement Lot 8, 2026-07-06 — total 12 sites sur 7 fichiers).
 *  Chaque abaissement = une vraie migration vers la donnée ; chaque hausse = une régression. */
const BASELINES: Record<string, number> = {
  'src/engine/items.ts': 1,
  'src/engine/magic.ts': 1,
  'src/engine/psychology.ts': 1,
  'src/engine/traits/dispatch.ts': 3,
  'src/state/ai.ts': 3,
  'src/state/combatManeuvers.ts': 2,
  'src/state/mount.ts': 1,
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

/** Nombre de sites réactifs par-nom, par fichier relatif (uniquement les fichiers non-vides). */
function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of scanFiles()) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const n = scanHardcode(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « tout migrer » — réactions de combat hardcodées (cliquet généralisé, Lot 8)', () => {
  it('aucun fichier de src/engine + src/state ne dépasse sa baseline gelée', () => {
    const counts = countsByFile();
    const offenders: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const baseline = BASELINES[rel] ?? 0;
      if (n > baseline) offenders.push(`${rel} : ${n} sites réactifs par-nom (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      'Nouveau(x) hardcode(s) réactif(s) par-nom — migrer vers la DONNÉE (TriggeredEffect/passive), ' +
        `ou si migration déjà faite ABAISSER la baseline du fichier :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    // Sans ce resserrage, la baseline ne fond jamais : un fichier nettoyé par un lot suivant
    // resterait toléré à son ancien niveau. Ici elle devient rouge → la dette se rembourse
    // mécaniquement au fil des migrations (même patron que no-emoji-affordance.test.ts).
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});
