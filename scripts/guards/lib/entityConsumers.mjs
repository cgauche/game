// Corpus PARTAGÉ de détection de consommateurs d'ENTITÉS de catalogue — consommé par
// `scripts/docs/build-entity-orphans.mjs` (générateur du rapport) ET `src/data/entity-orphans.test.ts`
// (garde cliquet). Généralise le patron mesuré dans `tableConsumerStock.mjs`/`tables.test.ts` (#734)
// à tout catalogue `src/data/*.json` adressé par `id` (le même ensemble que `id-collisions.test.ts`
// nomme « catégories » : `traits`, `talents`, `qualities`, `maneuvers`, `skills`, `props`, `vehicles`
// — cf. en-tête de `scripts/docs/build-entity-orphans.mjs` pour le périmètre RETENU/ÉCARTÉ).
//
// Définition d'un CONSOMMATEUR (reprise durcie de tableConsumerStock.mjs) : l'id de l'entité apparaît
// comme jeton de chaîne CITÉ complet (`"<id>"` ou `'<id>'`) dans (a) un AUTRE `src/data/*.json`
// (catalogue cible ou non — un maneuver peut citer un autre maneuver, un trapping peut citer une
// qualité…), (b) le code de prod `src/**/*.ts(x)` hors tests, COMMENTAIRES retirés. Jamais une
// sous-chaîne nue (prose, id plus long, mention non citée en commentaire).
//
// Amélioration sur `tableConsumerStock.mjs` : au lieu d'une regex fragile sur l'ORDRE des clés
// (`"id": "…", (?="label")`), la déclaration de l'entité dans SON PROPRE catalogue est retirée par
// PARSE JSON (suppression de la seule clé top-level `id` avant re-sérialisation) — robuste à
// n'importe quel ordre/forme de champs, généralisable aux 7 catalogues sans regex par fichier.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Catalogues `src/data/*.json` adressés par `id`, retenus pour la mesure d'orphelines — MÊME
 *  ensemble que `CATEGORIES` de `src/data/id-collisions.test.ts`, moins `spells`/`trappings`/
 *  `creatures` (écartés, cf. en-tête de `build-entity-orphans.mjs`). */
export const CATEGORY_FILES = {
  traits: 'traits.json',
  talents: 'talents.json',
  qualities: 'qualities.json',
  maneuvers: 'maneuvers.json',
  skills: 'skills.json',
  props: 'props.json',
  vehicles: 'vehicles.json',
};

/** `{ [category]: string[] }` — tous les ids de chaque catalogue retenu. */
export function loadCategoryIds(dataDir) {
  const out = {};
  for (const [cat, file] of Object.entries(CATEGORY_FILES)) {
    const arr = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
    out[cat] = arr.map((e) => e.id);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Corpus texte de tous les consommateurs possibles : `src/data/*.json` (catalogues cibles PRIVÉS de
 *  la déclaration `id` de LEURS PROPRES entités, sinon chaque entité « se consomme elle-même » via
 *  sa propre ligne JSON) + `src/**\/*.ts(x)` de PRODUCTION (hors tests, commentaires retirés). */
export function buildConsumerCorpus(dataDir, srcDir) {
  let corpus = '';
  const dataFiles = readdirSync(dataDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const targetFiles = new Set(Object.values(CATEGORY_FILES));
  for (const f of dataFiles) {
    const raw = readFileSync(join(dataDir, f), 'utf8');
    if (targetFiles.has(f)) {
      const arr = JSON.parse(raw);
      corpus += arr.map((e) => JSON.stringify({ ...e, id: undefined })).join('\n');
    } else {
      corpus += raw;
    }
  }
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) corpus += stripComments(readFileSync(p, 'utf8'));
    }
  };
  walk(srcDir);
  return corpus;
}

/** Un id compte comme consommé s'il apparaît comme jeton de chaîne CITÉ complet. */
export const isConsumed = (corpus, id) => corpus.includes(`"${id}"`) || corpus.includes(`'${id}'`);
