import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDataset, EXEMPT_DATASETS } from '../../scripts/guards/lib/citationCoverage.mjs';

/**
 * Garde-fou « citation par ENTRÉE » (#309, phase 1 — suite #278/#281). #278/#281 gardent la FORME
 * de `sourceRefSchema` ; ce garde mesure la COUVERTURE réelle par entrée (comptage entrée-aware,
 * `citationCoverage.mjs` — jamais les ids imbriqués) et l'empêche de RÉGRESSER.
 *
 * MODE CLIQUET (patron `combat-hardcode-guard.test.ts`) : `BASELINES` gèle, PAR DATASET NON
 * EXEMPTÉ, le nombre d'entrées SANS citation mesuré au recensement (#309, 2026-07-11). Le test
 * échoue si un dataset DÉPASSE sa baseline (= nouvelle entrée sans source = régression, tolérance
 * ZÉRO immédiate pour tout dataset déjà à 0 manquant) OU si une baseline est devenue trop haute
 * (dataset curé sans que la baseline soit abaissée). Un dataset absent de `BASELINES` a une
 * baseline 0 implicite (tolérance zéro dès aujourd'hui — `skills`/`gods`/`classes`/`species`/
 * `creatures`/`trappings`/`talents`/`careers`/`mutations`/`spells`/`qualities`/`activities`/
 * `naval-*` y compris, tous 100% au recensement, ne portent PAS d'entrée `BASELINES`).
 *
 * EXEMPTION nominative (`EXEMPT_DATASETS`, `citationCoverage.mjs`) : vocabulaires app-internes
 * SANS mécanique RAW à sourcer (props/groupes/matériaux de rendu, palettes, prégénérés, réf
 * `_source` unique d'`aa-criticals.json`…) — jamais scannés par ce garde.
 *
 * La CURATION (retrouver les folios manquants) est la PHASE 2 du ticket, hors périmètre : ce garde
 * ne fait QUE geler l'état mesuré et bloquer toute HAUSSE.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Baseline gelée = nombre d'entrées SANS citation, par dataset, au recensement #309
 *  (2026-07-11). Chaque abaissement = une vraie curation (folio retrouvé ou tag `maison`) ;
 *  chaque hausse = une régression. Datasets déjà à 0 manquant (skills/gods/classes/species/
 *  creatures/trappings/talents/careers/mutations/spells/qualities/activities/naval-*…) restent
 *  HORS de cette table (baseline 0 implicite, tolérance zéro dès aujourd'hui). */
const BASELINES: Record<string, number> = {
  'advancementCosts.json': 15,
  'calendarIntercalary.json': 6,
  'calendarMonths.json': 12,
  'calendarPhases.json': 7,
  'calendarWeekdays.json': 8,
  'careerLevels.json': 384,
  'crew-roles.json': 9,
  'criticals.json': 80,
  'driving-mishap.json': 4,
  'drunkenness.json': 5,
  'encumbranceTiers.json': 4,
  'grapple.json': 1,
  'interludeEvents.json': 31,
  'maladies.json': 11,
  'miscast.json': 71,
  'mutationTables.json': 17,
  'naval-traits.json': 1,
  'oups.json': 7,
  'peripeties.json': 10,
  'steam-breakdown.json': 6,
  'traumas.json': 26,
  'weaponGroups.json': 37,
  'weather.json': 4,
};

function missingByFile(): Record<string, number> {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const missing: Record<string, number> = {};
  for (const f of files) {
    if (EXEMPT_DATASETS[f]) continue;
    const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
    const { total, cited } = auditDataset(data);
    const n = total - cited;
    if (n > 0) missing[f] = n;
  }
  return missing;
}

describe('garde-fou « citation par entrée » — couverture source:{book,page} (cliquet, #309)', () => {
  it('aucun dataset non exempté ne dépasse sa baseline gelée d\'entrées sans citation', () => {
    const missing = missingByFile();
    const offenders: string[] = [];
    for (const [file, n] of Object.entries(missing)) {
      const baseline = BASELINES[file] ?? 0;
      if (n > baseline) offenders.push(`${file} : ${n} entrées sans citation (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      "Nouvelle entrée sans citation — poser source:{book,page} (ou EXEMPT_DATASETS si vocabulaire app-interne), " +
        `ou si curation déjà faite ABAISSER la baseline du dataset :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (dataset curé) doit être ABAISSÉE', () => {
    const missing = missingByFile();
    const stale: string[] = [];
    for (const [file, baseline] of Object.entries(BASELINES)) {
      const n = missing[file] ?? 0;
      if (n < baseline) stale.push(`${file} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });

  it('fail-closed : une entrée fictive sans source dans un dataset à 100% (skills.json) fait rouge, puis retirée redevient vert', () => {
    const real = JSON.parse(readFileSync(join(DATA_DIR, 'skills.json'), 'utf8'));
    const baseline = BASELINES['skills.json'] ?? 0; // 0 — skills.json est déjà à 100%, hors BASELINES
    const before = auditDataset(real);
    expect(before.total - before.cited).toBe(baseline);

    const contaminated = [...real, { id: 'test-fictif', label: 'Entrée fictive', characteristic: 'agilite', type: 'base', specs: [] }];
    const red = auditDataset(contaminated);
    expect(red.total - red.cited).toBe(1);
    expect(red.total - red.cited > baseline).toBe(true); // ROUGE : dépasse la baseline gelée

    const retired = contaminated.filter((e: { id: string }) => e.id !== 'test-fictif');
    const green = auditDataset(retired);
    expect(green.total - green.cited).toBe(baseline); // VERT : retirée, retour à la baseline
  });

  it('EXEMPT_DATASETS ne cible que des fichiers réellement présents', () => {
    const files = new Set(readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')));
    const dangling = Object.keys(EXEMPT_DATASETS).filter((f) => !files.has(f));
    expect(dangling, `Exemption(s) fantôme(s) (fichier absent) — nettoyer EXEMPT_DATASETS :\n${dangling.join('\n')}`).toEqual([]);
  });
});
