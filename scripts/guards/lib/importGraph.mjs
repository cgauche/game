// Mécanique de graphe d'imports PARTAGÉE (extraite de `scripts/docs/build-systemes.mjs`, #298) —
// résolution d'un import relatif vers un fichier source réel + closure transitive depuis un jeu de
// modules racines, bornée à `src/`. RÉUTILISÉE par `genericDomainImport.mjs` (#329) : jamais un 2ᵉ
// parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Extensions de MODULE que le dépôt écrit réellement : les libs de garde et les générateurs vivent en
// `.mjs` (109 imports relatifs de `src/**` vers `scripts/**` mesurés le 2026-09-02), donc `.mjs`/`.cjs`
// font partie de ce qu'un spécificateur relatif peut désigner ici.
const EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.cjs', '.js'];

/** Capture les imports/réexports statiques (`from '…'`), dynamiques (`import('…')`, ex. `lazy`) et À
 *  EFFET DE BORD (`import './x'`, sans `from` — il n'en existe aucun dans la clôture aujourd'hui,
 *  mais un module ainsi tiré serait invisible de la marche, donc du mur d'ordre total #1679 L3b).
 *  Spécificateur en m[1] (statique), m[2] (dynamique) ou m[3] (effet de bord, RELATIF seulement).
 *  @type {RegExp} */
export const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"](\.[^'"]+)['"]/g;

/** Extensions qu'un spécificateur peut porter LUI-MÊME (le chemin désigne alors le fichier). */
const EXTS_EXPLICITES = [...EXTS, '.json'];

/**
 * Résout un spécificateur d'import RELATIF (`./foo`, `../bar`) vers un fichier source réel :
 * spécificateur portant DÉJÀ son extension (`./x.mjs`, `./data.json` — la forme des 109 imports de
 * `src/**` vers les libs de garde), sinon extension déduite d'`EXTS`, sinon repli `index.*`. Les
 * paquets npm / alias non-relatifs renvoient `null` (hors périmètre — pas résolus ici).
 * @param {string} fromFile @param {string} spec @returns {string|null}
 */
export function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  if (EXTS_EXPLICITES.some((e) => spec.endsWith(e))) return existsSync(base) ? base.split('\\').join('/') : null;
  for (const ext of EXTS) if (existsSync(base + ext)) return (base + ext).split('\\').join('/');
  if (existsSync(base) && existsSync(join(base, 'index.ts'))) return join(base, 'index.ts').split('\\').join('/');
  for (const ext of EXTS) if (existsSync(join(base, 'index' + ext))) return join(base, 'index' + ext).split('\\').join('/');
  return null;
}

/**
 * Enfants d'un module : TOUS ses imports relatifs résolus, sans borne. `null` = fichier absent (hors
 * closure) ; `[]` = membre sans graphe à lire (`.json`, #487) ou illisible.
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
    const resolved = resolveImport(abs, m[1] ?? m[2] ?? m[3]);
    if (resolved) enfants.push(resolved);
  }
  return enfants;
}

/**
 * MARCHE du graphe d'imports RELATIFS depuis un jeu de modules racines : résolution + parcours
 * transitif, sans borne. La borne est un PRÉDICAT de l'appelant (`retenir`, appliqué aux ENFANTS —
 * les racines entrent toujours) : un seul hôte, aucune branche par type d'appelant.
 * `cache` (module -> enfants résolus) est PARTAGEABLE entre plusieurs marches d'un MÊME appelant :
 * les 16 systèmes de `systemes.manifest.json` visitent 21 197 modules pour 1 859 distincts (mesuré le
 * 2026-08-23) — sans partage, chaque fichier est relu et re-résolu 11 fois. Le cache porte les
 * enfants NON filtrés : il reste valable quel que soit le prédicat. Par défaut le cache naît et
 * meurt avec l'appel : aucun état ne survit entre deux marches indépendantes.
 * @param {string[]} roots
 * @param {{ retenir?: (abs: string) => boolean, cache?: Map<string, string[]|null> }} [options]
 * @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function clotureDImports(roots, { retenir, cache = new Map() } = {}) {
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
    for (const e of enfants) if (!retenir || retenir(e)) stack.push(e);
  }
  return seen;
}

/**
 * Closure transitive des imports RELATIFS depuis un jeu de modules racines, bornée à `src/` : la
 * MARCHE ci-dessus, avec le prédicat `src/` posé ici, par l'appelant.
 * @param {string[]} roots @param {Map<string, string[]|null>} [cache]
 * @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function closureOf(roots, cache = new Map()) {
  return clotureDImports(roots, { retenir: (abs) => abs.includes('/src/'), cache });
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
    const resolved = resolveImport(fromFile, m[1] ?? m[2] ?? m[3]);
    if (resolved && resolved.includes('/src/')) found.add(resolved.slice(root.length + 1));
  }
  return [...found];
}
