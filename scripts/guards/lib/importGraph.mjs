// Mécanique de graphe d'imports PARTAGÉE (extraite de `scripts/docs/build-systemes.mjs`, #298) —
// résolution d'un import relatif vers un fichier source réel + closure transitive depuis un jeu de
// modules racines, bornée à `src/`. RÉUTILISÉE par `genericDomainImport.mjs` (#329) : jamais un 2ᵉ
// parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const EXTS = ['.ts', '.tsx', '.mts', '.js'];

/** Capture des imports/réexports nommés OU bare (`from '…'`). @type {RegExp} */
export const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]/g;

/**
 * Résout un spécificateur d'import RELATIF (`./foo`, `../bar`) vers un fichier source réel
 * (`.ts`/`.tsx`/`.mts`/`.js`, avec repli `index.*`). Les paquets npm / alias non-relatifs
 * renvoient `null` (hors périmètre — pas résolus ici).
 * @param {string} fromFile @param {string} spec @returns {string|null}
 */
export function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const ext of EXTS) if (existsSync(base + ext)) return (base + ext).split('\\').join('/');
  if (existsSync(base) && existsSync(join(base, 'index.ts'))) return join(base, 'index.ts').split('\\').join('/');
  for (const ext of EXTS) if (existsSync(join(base, 'index' + ext))) return join(base, 'index' + ext).split('\\').join('/');
  return null;
}

/**
 * Closure transitive des imports RELATIFS depuis un jeu de modules racines, bornée à `src/`.
 * @param {string[]} roots @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function closureOf(roots) {
  const seen = new Set();
  const stack = [...roots.map((r) => resolve(r).split('\\').join('/'))];
  while (stack.length) {
    const abs = stack.pop();
    const rel = abs.slice(resolve('.').split('\\').join('/').length + 1);
    if (seen.has(rel)) continue;
    if (!existsSync(abs)) continue;
    seen.add(rel);
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(abs, m[1]);
      if (resolved && resolved.includes('/src/')) stack.push(resolved);
    }
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
    const resolved = resolveImport(fromFile, m[1]);
    if (resolved && resolved.includes('/src/')) found.add(resolved.slice(root.length + 1));
  }
  return [...found];
}
