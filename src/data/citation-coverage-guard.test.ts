import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDataset, EXEMPT_DATASETS, isCitedItem } from '../../scripts/guards/lib/citationCoverage.mjs';

/**
 * Garde-fou « citation par ENTRÉE » (#309, phase 1 — suite #278/#281). #278/#281 gardent la FORME
 * de `sourceRefSchema` ; ce garde mesure la COUVERTURE réelle par entrée (comptage entrée-aware,
 * `citationCoverage.mjs` — jamais les ids imbriqués) et l'empêche de RÉGRESSER.
 *
 * MODE CLIQUET (patron `combat-hardcode-guard.test.ts`) : `BASELINES` gèle, PAR DATASET NON
 * EXEMPTÉ, le nombre d'entrées SANS citation. Le test échoue si un dataset DÉPASSE sa baseline
 * (= nouvelle entrée sans source = régression) OU si une baseline est devenue trop haute (dataset
 * curé sans que la baseline soit abaissée). Un dataset absent de `BASELINES` a une baseline 0
 * implicite (tolérance zéro — TOUS les datasets non exemptés, phase 3 (#309, 2026-07-11) ayant vidé
 * les 16 derniers manques).
 *
 * EXEMPTION nominative (`EXEMPT_DATASETS`, `citationCoverage.mjs`) : vocabulaires app-internes
 * SANS mécanique RAW à sourcer (props/groupes/matériaux de rendu, palettes, prégénérés, réf
 * `_source` unique d'`aa-criticals.json`…) — jamais scannés par ce garde.
 *
 * PHASE 3 (#309, 2026-07-11) : `BASELINES` VIDÉE — les 16 derniers datasets (miscast/interludeEvents/
 * advancementCosts/calendrier ×3/crew-roles/peripeties/oups/steam-breakdown/drunkenness/
 * driving-mishap/encumbranceTiers/weather/grapple) sont curés à 100% (`calendarPhases.json` exempté :
 * découpage app-interne de lumière/vision, introuvable comme table RAW nommée — cf.
 * `EXEMPT_DATASETS`). Zéro entrée extraite sans source sur `src/data/*.json`.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Baseline gelée = nombre d'entrées SANS citation, par dataset. Vidée à la phase 3 (#309,
 * 2026-07-11) — tout dataset non listé ici est à 0 manquant (baseline 0 implicite).
 *
 * `reglesOptionnelles.json` (2026-08-16, V9 du programme #1318 — cliquet E8) : le registre des règles
 * optionnelles a migré du CODE (`src/engine/policy.ts`) en donnée. Chaque entrée porte déjà sa `ref`
 * (livre + chapitre + ligne quand le passage en porte une, abréviation vérifiée contre `books.json`
 * par `src/engine/policy-donnee.test.ts`) et les 26 valeurs MAISON portent leur `maison` — restent 55
 * entrées dont le folio IMPRIMÉ qu'exige `source: {book,page}` n'a pas été relevé (la LIGNE des réfs
 * a dérivé à la ré-extraction Marker 2026-06-22 : le folio ne s'en dérive pas automatiquement). Ce
 * chiffre ne peut que DESCENDRE, cible 0 — le second volet ci-dessous fait rougir toute baseline
 * devenue trop haute.
 */
const BASELINES: Record<string, number> = {
  'reglesOptionnelles.json': 54, // −1 (#1318 E4/C4-δ2) : `test-intimidation-char` ré-ancrée LDB 09 l.294 (l.266 tombait dans Guérison)
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

  it('MORSURE (#563 Lot 1 item 1) : une entrée avec `alsoIn` compte CITÉE ; l\'ancien guard la ratait', () => {
    const withAlsoIn = { id: 'fixture', label: 'Fixture', alsoIn: [{ book: 'zoo-imperial', page: 23 }] };
    expect(isCitedItem(withAlsoIn)).toBe(true);

    // Ancien guard (trou permissif décrit #563 : ne voit QUE `source`, ignore `alsoIn`) — rétabli
    // ICI en local pour la preuve de morsure, jamais réintroduit dans citationCoverage.mjs.
    const ancienGuard = (item: unknown): boolean => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const rec = item as Record<string, unknown>;
      if (rec.source && typeof rec.source === 'object' && !Array.isArray(rec.source) && typeof (rec.source as Record<string, unknown>).book === 'string') return true;
      if (typeof rec._source === 'string' && rec._source.length > 0) return true;
      if (typeof rec.maison === 'string' && rec.maison.length > 0) return true;
      return false;
    };
    expect(ancienGuard(withAlsoIn)).toBe(false); // ROUGE avec l'ancien guard : bascule non-citée
  });

  it('EXEMPT_DATASETS ne cible que des fichiers réellement présents', () => {
    const files = new Set(readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')));
    const dangling = Object.keys(EXEMPT_DATASETS).filter((f) => !files.has(f));
    expect(dangling, `Exemption(s) fantôme(s) (fichier absent) — nettoyer EXEMPT_DATASETS :\n${dangling.join('\n')}`).toEqual([]);
  });
});
