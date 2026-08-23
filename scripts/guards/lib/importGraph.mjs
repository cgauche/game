// Mécanique de graphe d'imports PARTAGÉE (extraite de `scripts/docs/build-systemes.mjs`, #298) —
// résolution d'un import relatif vers un fichier source réel + closure transitive depuis un jeu de
// modules racines, bornée à `src/`. RÉUTILISÉE par `genericDomainImport.mjs` (#329) : jamais un 2ᵉ
// parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const EXTS = ['.ts', '.tsx', '.mts', '.js'];

/** Capture les imports/réexports statiques (`from '…'`) ET dynamiques (`import('…')`, ex. `lazy`).
 *  Spécificateur en m[1] (statique) ou m[2] (dynamique). @type {RegExp} */
export const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Résout un spécificateur d'import RELATIF (`./foo`, `../bar`) vers un fichier source réel
 * (`.ts`/`.tsx`/`.mts`/`.js`, avec repli `index.*`). Les paquets npm / alias non-relatifs
 * renvoient `null` (hors périmètre — pas résolus ici).
 * @param {string} fromFile @param {string} spec @returns {string|null}
 */
export function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  if (spec.endsWith('.json')) return existsSync(base) ? base.split('\\').join('/') : null;
  for (const ext of EXTS) if (existsSync(base + ext)) return (base + ext).split('\\').join('/');
  if (existsSync(base) && existsSync(join(base, 'index.ts'))) return join(base, 'index.ts').split('\\').join('/');
  for (const ext of EXTS) if (existsSync(join(base, 'index' + ext))) return join(base, 'index' + ext).split('\\').join('/');
  return null;
}

/**
 * Enfants `src/` d'un module : ses imports relatifs résolus. `null` = fichier absent (hors closure) ;
 * `[]` = membre sans graphe à lire (`.json`, #487) ou illisible.
 * @param {string} abs @param {string} rel @returns {string[]|null}
 */
function enfantsDe(abs, rel) {
  if (!existsSync(abs)) return null;
  if (rel.endsWith('.json')) return [];
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  const enfants = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(abs, m[1] ?? m[2]);
    if (resolved && resolved.includes('/src/')) enfants.push(resolved);
  }
  return enfants;
}

/**
 * Closure transitive des imports RELATIFS depuis un jeu de modules racines, bornée à `src/`.
 * `cache` (module -> enfants résolus) est PARTAGEABLE entre plusieurs closures d'un MÊME appelant :
 * les 16 systèmes de `systemes.manifest.json` visitent 21 197 modules pour 1 859 distincts (mesuré le
 * 2026-08-23) — sans partage, chaque fichier est relu et re-résolu 11 fois. Par défaut le cache naît
 * et meurt avec l'appel : aucun état ne survit entre deux closures indépendantes.
 * @param {string[]} roots @param {Map<string, string[]|null>} [cache]
 * @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function closureOf(roots, cache = new Map()) {
  const seen = new Set();
  const cwdPosix = resolve('.').split('\\').join('/') + '/';
  const stack = [...roots.map((r) => resolve(r).split('\\').join('/'))];
  while (stack.length) {
    const abs = stack.pop();
    // Racine HORS repo (fixtures de test en tmpdir) : chemin absolu POSIX, jamais tronque a l aveugle.
    const rel = abs.startsWith(cwdPosix) ? abs.slice(cwdPosix.length) : abs;
    if (seen.has(rel)) continue;
    let enfants = cache.get(abs);
    if (enfants === undefined) {
      enfants = enfantsDe(abs, rel);
      cache.set(abs, enfants);
    }
    if (enfants === null) continue;
    seen.add(rel);
    for (const e of enfants) stack.push(e);
  }
  return seen;
}

/**
 * Imports RELATIFS directs (non transitifs) d'un fichier — résolus vers des chemins POSIX
 * relatifs à la racine du repo, dédupliqués, `src/`-only.
 * @param {string} fromFile @param {string} contenu @returns {string[]}
 */
export function directImportsOf(fromFile, contenu) {
  const root = resolve('.').split('\\').join('/');
  const found = new Set();
  for (const m of contenu.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(fromFile, m[1] ?? m[2]);
    if (resolved && resolved.includes('/src/')) found.add(resolved.slice(root.length + 1));
  }
  return [...found];
}
