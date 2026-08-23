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
import { existsSync, readdirSync } from 'node:fs';
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
    if (typeof b.dir !== 'string' || !b.dir) continue;
    const abs = join(root, b.dir);
    if (existsSync(abs) && aDesChapitres(abs)) extraits.add(b.id);
    else dirManquant.push(b.id);
  }
  return { extraits, dirManquant };
}

/** Dossiers d'extraction FR présents sous `Source/` — préfixes du dépôt, ou suffixe « VF ». */
export function frenchSourceDirs(root) {
  try {
    return readdirSync(join(root, 'Source'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && (/^(Warhammer v4|WH - V4)\b/.test(e.name) || / VF$/.test(e.name)))
      .map((e) => `Source/${e.name}`)
      .filter((d) => aDesChapitres(join(root, d)))
      // NFC EN DERNIER : le disque rend « Boîte » en décomposé (o + U+0302) et `books.json` en
      // composé — normaliser AVANT le `filter` donnerait un chemin que `readdirSync` ne trouve pas.
      .map((d) => d.normalize('NFC'))
      .sort();
  } catch { return []; }
}
