import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANS_LIVRE, SANS_PROVENANCE_EXIGEE, SOURCE_EN_PROFONDEUR } from './schemas/grammaire/sans-livre';

/**
 * Cliquet « entrée MAISON sans folio » (#1467 L1b V-Src) — patron stock décroissant
 * (`scripts/guards/lib/structuresStock.mjs`).
 *
 * `document()` accepte `source` OU `maison` : une entrée sans folio n'est pas interdite, elle doit
 * dire pourquoi. Ce régime est nécessaire (le canon est muet sur des points qu'un jeu sans MJ doit
 * trancher) et il est exactement ce qui peut DÉRIVER : rien n'empêche, sans cliquet, d'écrire
 * `maison` plutôt que de chercher le folio. Ce test gèle donc, PAR DATASET, le nombre d'entrées de
 * premier niveau qui portent `maison` SANS `source`. Dépasser sa baseline = rouge nominatif ;
 * décroître = abaisser la baseline DANS LE MÊME COMMIT (le stock ne fait que décroître).
 *
 * PÉRIMÈTRE — les types exemptés (`SANS_PROVENANCE_EXIGEE` = `SANS_LIVRE` ∪ `SOURCE_EN_PROFONDEUR`)
 * sont hors mesure : leur document entier est déclaré sans provenance exigible à l'entrée de racine,
 * y compter des `maison` mélangerait deux régimes.
 *
 * Ce que cette borne masque AUJOURD'HUI est GELÉ NOMINATIVEMENT (`MASQUES_GELES`, asserté plus bas) :
 * 29 des 30 raisons de coût d'`actions.json`, entrées dans le périmètre mesurable par la migration
 * `2026-08-27-l1b-4b-actions-maison-raison.mjs` (le couple `maison: true` + `costNote` y est devenu la
 * RAISON en clair). Chacune de ces 29 entrées porte sa raison dans le champ `maison` ; `actions` est
 * dans `SANS_LIVRE` (`schemas/grammaire/sans-livre.ts:41`), et 12 de ses 55 entrées citent malgré tout
 * un folio. 29 et non 30 : `switch-loadout`
 * porte SA raison ET son folio (LDB 13 l.106) — le prédicat exige `source` absente, il n'est donc pas
 * masqué. Tout masqué NOUVEAU — une 30ᵉ entrée d'`actions.json` sans folio, ou un autre dataset
 * exempté — rougit nominativement. Le total hors exemption vaut 44.
 *
 * Second volet : AUCUN champ `source` de type CHAÎNE dans les deux racines de documents. `source`
 * est la réf `{book, page}` ; une chaîne y passe au travers de tout lecteur générique de provenance
 * sans erreur ET sans être comptée. `axes.json` en portait 9 (`source: 'maison'`), migrées en champ
 * `maison` par `scripts/migrations/2026-08-27-l1b-1c-axes-maison.mjs`.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const SCENES_DIR = fileURLToPath(new URL('../scenes', import.meta.url));

/**
 * Entrées de premier niveau portant `maison` SANS `source`, par dataset — gelé au 2026-08-27,
 * APRÈS la migration 1c. `actions.json` n'y figure pas : il est dans `SANS_LIVRE` (cf. PÉRIMÈTRE).
 *
 * `axes.json` (9) est ENTRÉ dans ce stock au geste même qui l'y a rendu mesurable : ses 9 entrées
 * portaient `source: 'maison'` (une chaîne), invisible de tout lecteur de provenance ; elles portent
 * désormais `maison`. Ce n'est pas une dérive, c'est un angle mort qui devient un compte. Les axes
 * sont MAISON par construction (#409) : cette ligne n'est pas attendue à décroître, elle est
 * attendue à NE PAS CROÎTRE. Les trois autres, elles, se soldent au fil du sourçage (L1d #1469).
 */
const BASELINES: Record<string, number> = {
  'axes.json': 9,
  'crew-roles.json': 7,
  'naval-traits.json': 1,
  'reglesOptionnelles.json': 27,
};

const TOTAL_GELE = 44;

/** Entrées `maison` sans `source` des datasets EXEMPTÉS — gelé au 2026-08-27, APRÈS la migration 4b.
 *  Ce que la borne soustrait au cliquet, nommé dataset par dataset : un masqué de plus, ici ou
 *  ailleurs, n'a nulle part où se cacher. */
const MASQUES_GELES: Record<string, number> = { 'actions.json': 29 };

const lire = (dir: string, f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));

/** `.json` du dossier — RÉCURSIF : les projets de `src/scenes` vivent en sous-dossiers
 *  (`arene/arene-projet.json`), un scan à plat les manquerait en silence. */
function jsons(dir: string, prefixe = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...jsons(join(dir, e.name), `${prefixe}${e.name}/`));
    else if (e.name.endsWith('.json')) out.push(`${prefixe}${e.name}`);
  }
  return out;
}

/** `maison` non vide ET `source` absente, sur les entrées de PREMIER niveau. */
function maisonSansSource(data: unknown): number {
  const items = Array.isArray(data) ? data : [data];
  return items.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    const r = e as Record<string, unknown>;
    return typeof r.maison === 'string' && r.maison.length > 0 && r.source === undefined;
  }).length;
}

function mesure(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of jsons(DATA_DIR)) {
    if (SANS_PROVENANCE_EXIGEE[f.replace(/\.json$/, '')]) continue;
    let data: unknown;
    try {
      data = lire(DATA_DIR, f);
    } catch {
      continue;
    }
    const n = maisonSansSource(data);
    if (n > 0) out[f] = n;
  }
  return out;
}

describe('cliquet « maison sans source » — le régime d’arbitrage ne dérive pas (#1467 L1b)', () => {
  it('aucun dataset ne DÉPASSE sa baseline gelée', () => {
    const mesuree = mesure();
    const fautifs: string[] = [];
    for (const [f, n] of Object.entries(mesuree)) {
      const base = BASELINES[f] ?? 0;
      if (n > base) fautifs.push(`${f} : ${n} entrée(s) maison sans source (baseline ${base})`);
    }
    expect(fautifs, `régression — un folio a été remplacé par un arbitrage :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('aucune baseline n’est devenue TROP HAUTE (un dataset curé se solde dans le même commit)', () => {
    const mesuree = mesure();
    const perimees: string[] = [];
    for (const [f, base] of Object.entries(BASELINES)) {
      const n = mesuree[f] ?? 0;
      if (n < base) perimees.push(`${f} : baseline ${base}, mesuré ${n} — abaisser la baseline`);
    }
    expect(perimees, perimees.join('\n  ')).toEqual([]);
  });

  it('le TOTAL gelé est celui mesuré (le stock ne croît pas en silence)', () => {
    const total = Object.values(mesure()).reduce((a, b) => a + b, 0);
    expect(total).toBe(TOTAL_GELE);
  });

  it('la BORNE d’exemption ne masque QUE le connu — même prédicat appliqué aux datasets exemptés', () => {
    const masques: Record<string, number> = {};
    for (const f of jsons(DATA_DIR)) {
      if (!SANS_PROVENANCE_EXIGEE[f.replace(/\.json$/, '')]) continue;
      let data: unknown;
      try {
        data = lire(DATA_DIR, f);
      } catch {
        continue;
      }
      const n = maisonSansSource(data);
      if (n > 0) masques[f] = n;
    }
    // Si un exempté se met à porter des `maison` STRING hors du gel, la borne cesse d'être connue et le dit.
    expect(masques, `masqués par l’exemption — attendu ${JSON.stringify(MASQUES_GELES)}, mesuré ${JSON.stringify(masques)}`).toEqual(MASQUES_GELES);
  });

  it('le CONTENU des deux listes d’exemption est gelé (un ajout sort des entrées du cliquet)', () => {
    // Le cardinal ne suffit pas : un échange à cardinal constant doit rougir. On gèle les CLÉS.
    expect(Object.keys(SOURCE_EN_PROFONDEUR).sort()).toEqual([
      // `aa-criticals` y entre par #1467 L1b V-FLIP-CONFIG : sa note libre `_source` est morte, ses
      // 80 entrées portent chacune leur folio (83/84/85/86), et la racine reste NUE.
      'aa-criticals', 'arcane-phenomena', 'crew-test-types', 'criticals', 'disponibilite', 'land-cargo',
      'mass-battle', 'miscast', 'naval-progression', 'river-perils', 'sea-cargo', 'sea-events',
      'sea-navigation', 'sea-perils', 'sea-weather', 'ship-construction', 'weather',
    ]);
    expect(Object.keys(SANS_LIVRE).sort()).toEqual([
      'actions', 'ambiance', 'books', 'breath-types', 'calendarPhases', 'damage-types',
      'decorPalette', 'details', 'donnees.manifest', 'groups', 'lieux-services', 'lightLevels',
      'lightTones', 'localisation', 'merchantFamilies', 'merchants', 'names', 'pregens',
      'primitives.manifest', 'progression-schemas.derived', 'propMaterials', 'props',
      'qualitySubtypes', 'qualityTypes', 'raceAppearance', 'raw.manifest', 'reliefMaterials',
      'renduMonte', 'roofMaterials', 'sizes', 'speciesRace', 'structureAppearance',
      'systemes.manifest', 'teintesJeu',
    ]);
    // Les deux régimes sont DISJOINTS : une clé dans les deux rendrait l'union ambiguë.
    const communes = Object.keys(SANS_LIVRE).filter((k) => k in SOURCE_EN_PROFONDEUR);
    expect(communes).toEqual([]);
    // 50 → 51 : `aa-criticals` rejoint `SOURCE_EN_PROFONDEUR` (#1467 L1b V-FLIP-CONFIG).
    expect(Object.keys(SANS_PROVENANCE_EXIGEE)).toHaveLength(51);
  });

  it('`maison` est TOUJOURS une chaîne — zéro drapeau booléen, à TOUTE profondeur des deux racines', () => {
    // Le TYPE porte le contrat de l'enveloppe (`grammaire/document.ts` : la RAISON en clair). Un
    // `maison: true` ne dit aucune raison et passerait tous les lecteurs de provenance en silence.
    const fautifs: string[] = [];
    const walk = (n: unknown, ou: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${ou}[${i}]`));
      if (!n || typeof n !== 'object') return;
      const r = n as Record<string, unknown>;
      if (r.maison !== undefined && typeof r.maison !== 'string') fautifs.push(`${ou}.maison = ${JSON.stringify(r.maison)} (${typeof r.maison})`);
      for (const [k, v] of Object.entries(r)) walk(v, `${ou}.${k}`);
    };
    for (const [dir, etiquette] of [
      [DATA_DIR, 'src/data'],
      [SCENES_DIR, 'src/scenes'],
    ] as const) {
      for (const f of jsons(dir)) {
        try {
          walk(lire(dir, f), `${etiquette}/${f}`);
        } catch {
          continue;
        }
      }
    }
    expect(fautifs, `\`maison\` doit être la RAISON en clair — un drapeau ne dit rien :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('AUCUN champ `source` de type CHAÎNE dans les deux racines de documents', () => {
    const fautifs: string[] = [];
    const walk = (n: unknown, ou: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${ou}[${i}]`));
      if (!n || typeof n !== 'object') return;
      const r = n as Record<string, unknown>;
      if (typeof r.source === 'string') fautifs.push(`${ou}.source = ${JSON.stringify(r.source)}`);
      for (const [k, v] of Object.entries(r)) walk(v, `${ou}.${k}`);
    };
    for (const [dir, etiquette] of [
      [DATA_DIR, 'src/data'],
      [SCENES_DIR, 'src/scenes'],
    ] as const) {
      for (const f of jsons(dir)) {
        try {
          walk(lire(dir, f), `${etiquette}/${f}`);
        } catch {
          continue;
        }
      }
    }
    expect(fautifs, `\`source\` doit être {book,page} — une chaîne échappe à TOUT lecteur de provenance :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });
});
