/**
 * Marche PARTAGÉE des `skills[].spec` d'une entrée de catalogue (créature, niveau de Carrière,
 * espèce) et bornage du périmètre « livre EXTRAIT dans `Source/` » (#1342 L2-a).
 *
 * UNE implémentation, deux consommateurs : la migration `scripts/migrations/
 * 2026-08-23-specs-livres-autorises.mjs` et la garde `src/data/refs-migrated.test.ts`. Une marche
 * dupliquée entre le geste et sa garde, c'est une garde qui mesure autre chose que le geste.
 *
 * Module ESM pur (`node` nu, aucun import TS) — typé par `skillSpecWalk.d.mts`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Casse/accents neutralisés — comparaison de LIBELLÉS uniquement. */
export function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Sentinelle « (Au choix) » : un emplacement de spéc, pas une spéc. */
export function isSentinel(s) {
  return norm(s) === 'au choix';
}

/**
 * Visite tout nœud `{ id, spec? }` vivant sous un tableau `skills` de `entry` (y compris à travers
 * les enveloppes `{ ref: … }` d'`AdvancementRef`). `visit(node)` reçoit le nœud MUTABLE.
 */
export function walkSkillRefs(entry, visit) {
  const walk = (node, arrKey) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, arrKey));
    if (!node || typeof node !== 'object') return;
    if (arrKey === 'skills' && typeof node.id === 'string') visit(node);
    for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(v) ? k : (k === 'ref' ? arrKey : null));
  };
  walk(entry, null);
}

/** Le tableau `skills` PORTEUR d'un nœud donné, pour un retrait par `splice` (jamais `delete`). */
export function skillArraysOf(entry) {
  const out = [];
  const walk = (node, arrKey) => {
    if (Array.isArray(node)) {
      if (arrKey === 'skills') out.push(node);
      return node.forEach((x) => walk(x, arrKey));
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(v) ? k : (k === 'ref' ? arrKey : null));
  };
  walk(entry, null);
  return out;
}

/**
 * Dossier d'extraction d'un livre, quel que soit le champ qui le porte : `dir` pour les livres de
 * l'Atlas RAW (`scripts/raw/_lib.mjs#BOOK_ORDER` les exige, pont folio compris), `extractionDir`
 * pour une extraction citable HORS Atlas (`frenchy-bzh`). Une seule lecture, partagée par le
 * périmètre `extractedBooks` et par le volet « dossier FR réclamé » de la garde.
 */
export function sourceDirOf(book) {
  const d = book?.dir ?? book?.extractionDir;
  return typeof d === 'string' && d ? d : null;
}

/** Un chapitre d'extraction est un `NN - ….md` à la racine du dossier du livre. */
function aDesChapitres(dir) {
  try { return readdirSync(dir).some((f) => /^\d{2} - .+\.md$/.test(f)); } catch { return false; }
}

/**
 * Ids des livres dont l'extraction EXISTE SUR DISQUE (`books.json#dir` pointant un dossier qui
 * porte des chapitres), mesuré sous `root`. Le `dir` seul ne suffit pas : un clone sans `Source/`
 * rendrait le périmètre vide en silence — d'où `nonExtraits`, la contre-mesure du même passage.
 */
export function extractedBooks(books, root) {
  const extraits = new Set();
  const dirManquant = [];
  for (const b of books) {
    const dir = sourceDirOf(b);
    if (!dir) continue;
    const abs = join(root, dir);
    if (existsSync(abs) && aDesChapitres(abs)) extraits.add(b.id);
    else dirManquant.push(b.id);
  }
  return { extraits, dirManquant };
}

/** Mots-outils français, comptés sur un échantillon de chapitres : mesure du 2026-08-23 sur les 90
 *  dossiers de `Source/` — 10,5 à 21,0 pour les 20 extractions FR, 0,0 pour les 70 VO. */
const FR_MOTS_OUTILS = /\b(les|des|une|dans|vous|est|sont|avec|pour|qui)\b/gi;
const FR_SEUIL = 5;

/** Densité de mots-outils FR pour 1000 caractères, sur les 3 premiers chapitres d'un dossier. */
function densiteFR(dir) {
  const ech = readdirSync(dir)
    .filter((f) => /^\d{2} - .+\.md$/.test(f))
    .sort()
    .slice(0, 3)
    .map((f) => readFileSync(join(dir, f), 'utf8').slice(0, 20000))
    .join('\n');
  return (ech.match(FR_MOTS_OUTILS) ?? []).length / Math.max(1, ech.length / 1000);
}

/** Dossiers d'extraction FR présents sous `Source/`, reconnus au CONTENU (le nom ne dit pas la
 *  langue : `Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF` est FR sans porter
 *  aucun préfixe du dépôt). */
export function frenchSourceDirs(root) {
  try {
    return readdirSync(join(root, 'Source'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `Source/${e.name}`)
      .filter((d) => aDesChapitres(join(root, d)) && densiteFR(join(root, d)) >= FR_SEUIL)
      // NFC EN DERNIER : le disque rend « Boîte » en décomposé (o + U+0302) et `books.json` en
      // composé — normaliser AVANT le `filter` donnerait un chemin que `readdirSync` ne trouve pas.
      .map((d) => d.normalize('NFC'))
      .sort();
  } catch { return []; }
}
