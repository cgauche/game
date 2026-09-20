// LE PATHSPEC DES CATALOGUES DE L'ATLAS, écrit UNE fois (#1825). Module FEUILLE : aucun import.
//
// Les catalogues sont générés (`scripts/raw/build-catalogs.mjs`) et confrontés à leur source par une
// gate MUTANTE — régénérer, puis `git diff --exit-code` sur eux. Cinq sites portaient ce pathspec :
// la cible du générateur (`scripts/docs/build-all.mjs`), les deux classements de gate
// (`scripts/gates/gatesDeCi.mjs`, `scripts/gates/classerPush.mjs`) et les deux workflows YAML, qui
// ne peuvent rien importer. Une recopie de plus, et la gate confronte un ensemble VIDE sans que rien
// ne rougisse : un pathspec qui n'atteint plus aucun fichier rend `git diff --exit-code` à 0.
//
// La forme suit la partition de l'Atlas par CŒUR : `**` vaut zéro ou plusieurs dossiers, donc le
// motif atteint tout catalogue quel que soit son cœur, sans nommer aucun cœur. Le banc
// `scripts/raw/catalogues-aiguillage.test.mjs` confronte CE littéral aux deux YAML, à
// `.gitattributes` et à l'énumération réelle de la couture.

/** Le MOTIF, une seule écriture : `scripts/guards/lib/lister.mjs` (`motifDeGlob`, `correspondGlob`),
 *  `.gitattributes` et la cible du générateur le lisent tel quel. */
export const MOTIF_CATALOGUES = 'docs/raw/**/catalogue-*.md'

/** Le PATHSPEC git, DÉRIVÉ du motif. La magie `:(glob)` n'est pas décorative : c'est elle qui donne
 *  à git la sémantique de `motifDeGlob` — sans elle, un pathspec nu est un `fnmatch` SANS
 *  `FNM_PATHNAME`, où `*` traverse `/` et où `**` suivi d'un `/` exige un dossier RÉEL (mesuré :
 *  `git ls-files` sur le motif nu de `coverage.md` rend le vide, `:(glob)` rend `docs/raw/coverage.md`).
 *  Un catalogue posé à la racine de l'Atlas échapperait donc au pathspec nu — et `git diff
 *  --exit-code` sur un ensemble incomplet rend 0. */
export const pathspecDe = (motif) => `:(glob)${motif}`

export const PATHSPEC_CATALOGUES = pathspecDe(MOTIF_CATALOGUES)

/** La commande EXACTE de la gate des catalogues, telle que les deux workflows YAML l'écrivent — les
 *  apostrophes simples protègent `*`, `(` et `)` du shell d'Actions (`bash`), qui les rendrait
 *  sinon au glob du shell ou à sa substitution. */
export const COMMANDE_GATE_CATALOGUES = `npm run raw:catalogs && git diff --exit-code -- '${PATHSPEC_CATALOGUES}'`
