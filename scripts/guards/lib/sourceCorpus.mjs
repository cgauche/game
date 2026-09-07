// Corpus SOURCE d'un jeu de dossiers : la marche de dossiers + la lecture, en UN seul endroit —
// la marche de `listerArbre` + le `readFileSync` des gardes qui balaient l'arbre réel de `src/**`.
// Consommateurs : TOUTE garde qui balaie l'arbre réel de `src/**` — aucun compte n'est écrit ici, il
// périmerait au premier import suivant ; la liste se CALCULE (`grep -rl sourceCorpus.mjs src scripts`).
//
// FRONTIÈRE : cette lib LIT et MÉMOÏSE sa lecture, elle n'interprète pas (aucun AST, aucun verdict).
// Un corpus est lu UNE fois par clé — la clé est le CONTENU des paramètres (dossiers normalisés en
// chemin POSIX depuis la racine, extensions, `tests`) — et le mémo vit aussi longtemps que le graphe
// de modules : sous `isolate: false` (`vite.config.ts`), le worker Vitest entier, partagé par tous
// les fichiers de test qu'il joue.
//
// CONDITION DE LICÉITÉ : l'arbre scanné est STATIQUE pendant un run. Sous vitest, l'unique écrivain
// de `src/**` est `genAll()` du plugin `registryGen` (`vite.config.ts:18`, hook `buildStart`) : il
// écrit `src/**/_registry.generated.ts` dans le processus vite-node PRINCIPAL, avant le démarrage
// des workers, et seulement quand le contenu diffère (`scripts/gen-registry.mjs:426,711`). Les
// autres écrivains de l'arbre sont des gates, jouées EN SÉRIE avant les lanes de lecture
// (`AVANT_LES_LANES`, `scripts/gates/toutes.mjs:248`). Un appelant qui écrirait dans un dossier
// scanné entre deux lectures a sa porte : `viderCorpus()`.
//
// PRIX : le corpus est RETENU par le worker jusqu'à sa fin. Mesuré 2026-09-07 sur cet arbre, toutes
// les clés des appelants co-résidentes : 132,1 Mo de texte pour 8 clés (dont 35,9 Mo pour
// `['src','scripts']` × 5 extensions × `tests`, 4 314 fichiers).
//
// IMMUABLE : tableau et entrées gelés, et deux appels de même clé rendent le MÊME tableau avec les
// MÊMES entrées — c'est cette identité qui porte les mémos par identité des appelants (la `WeakMap`
// d'AST de `canonUnique.mjs`), d'un fichier de test à l'autre du même worker.
// Les FILTRES de périmètre (exclusions nominatives, dossiers de whitelist) restent chez l'appelant :
// ils font partie de ce que la garde MESURE.
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { listerArbre } from './lister.mjs';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt : `scripts/guards/lib/` → `../../../`. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');

const EST_TEST = /\.test\./;

/** Chemin POSIX depuis la racine du dépôt (`src/state`, `../Temp/xyz` pour une racine hors dépôt). */
const posixDepuisRacine = (p) => relative(ROOT, p).split('\\').join('/');

/** Corpus par CLÉ de contenu des paramètres. Vit aussi longtemps que ce module — soit, sous
 *  `isolate: false`, le worker Vitest entier. @type {Map<string, ReadonlyArray<Readonly<{ abs: string, rel: string, text: string }>>>} */
const CORPUS = new Map();

/**
 * Fichiers source de `dirs` (absolus, ou relatifs à la racine du dépôt), parcourus RÉCURSIVEMENT
 * en ORDRE TOTAL (`listerArbre`), avec leur texte. Lus UNE fois par clé (dossiers + extensions +
 * `tests`) : un second appel de même clé rend le MÊME tableau, sans toucher le disque.
 * @param {string[]} dirs l'ORDRE compte — il décide de l'ordre du résultat, donc de la clé. Chaque
 *   dossier est normalisé en chemin POSIX depuis la racine AVANT d'entrer dans la clé : absolu et
 *   relatif désignent le même corpus, `src/x/` comme `src/x`. La CASSE n'est pas normalisée — sur
 *   Windows `SRC/x` est une clé distincte, donc un mémo manqué, jamais un corpus faux.
 * @param {{ exts?: string[], tests?: boolean }} [opts] `exts` = extensions retenues
 *   (défaut `.ts`/`.tsx`) ; `tests` = garder les `*.test.*` (défaut : non).
 * @returns {ReadonlyArray<Readonly<{ abs: string, rel: string, text: string }>>} gelé, `rel` =
 *   chemin POSIX depuis la racine.
 */
export function readCorpus(dirs, { exts = ['.ts', '.tsx'], tests = false } = {}) {
  const bases = dirs.map((d) => (isAbsolute(d) ? d : join(ROOT, d)));
  const cle = JSON.stringify([bases.map(posixDepuisRacine), [...exts].sort(), tests]);
  const memo = CORPUS.get(cle);
  if (memo) return memo;
  const garde = (nom) => exts.some((e) => nom.endsWith(e)) && (tests || !EST_TEST.test(nom));
  const lu = Object.freeze(
    bases.flatMap((base) =>
      listerArbre(base, { filtre: garde }).map((rel) => {
        const p = join(base, rel);
        return Object.freeze({ abs: p, rel: posixDepuisRacine(p), text: readFileSync(p, 'utf8') });
      }),
    ),
  );
  CORPUS.set(cle, lu);
  return lu;
}

/** Relâche tous les corpus mémoïsés : la lecture suivante retourne au disque. C'est la PORTE de la
 *  condition de licéité du mémo (voir l'en-tête) — un appelant qui ÉCRIT dans un dossier scanné
 *  entre deux lectures la franchit. Aucune garde ne l'appelle : `genAll()` écrit avant les workers,
 *  les gates écrivantes tournent avant les lanes. Les tests de cette lib l'appellent. */
export function viderCorpus() {
  CORPUS.clear();
}
