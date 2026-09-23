/**
 * LIVRES EXTRAITS (#1389 Lot A, épique #1388) — les livres dont le texte est sur disque sous
 * `Source/`, donc les seuls qu'une adresse de prose (`descRef`) peut désigner. La liste n'est pas
 * écrite : elle est DÉRIVÉE de `books.json` (champs `abbr` et `dir`) — une seconde liste en dur
 * mentirait au premier livre extrait de plus.
 *
 * Consommé par le verrou de RÉSOLUBILITÉ de `grammaire/prose.ts` : une adresse dans un livre sans
 * extraction est irrésoluble, et se refuse au PARSE plutôt qu'à la lecture.
 *
 * DEUX MAISONS, UNE DÉFINITION (`abbr` ET `dir` non vides) : l'app ne peut pas importer `scripts/`,
 * l'outillage juge par `estLivreExtrait` (`scripts/raw/_lib.mjs`) ; les deux ensembles sont tenus
 * égaux par le contrat `src/data/prose-inline-contrat.test.ts` (d).
 */
import booksJson from '../../books.json';
import { memoParVersion } from '../../versionDataset';

/** Ids des livres EXTRAITS : `abbr` ET `dir` non vides. */
export const extraits = memoParVersion('books', (): ReadonlySet<string> => new Set(
  (booksJson as { id: string; abbr?: string; dir?: string }[])
    .filter((b) => Boolean(b.abbr && b.dir))
    .map((b) => b.id),
));

/** Ce livre a-t-il une extraction sur disque ? (`undefined` — pas de livre — n'en est pas une.) */
export function estExtrait(bookId: string | undefined): boolean {
  return bookId !== undefined && extraits().has(bookId);
}
