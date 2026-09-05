/**
 * LIVRES EXTRAITS (#1389 Lot A, épique #1388) — les livres dont le texte FR est sur disque sous
 * `Source/`, donc les seuls qu'une adresse de prose (`descRef`) peut désigner. La liste n'est pas
 * écrite : elle est DÉRIVÉE de `books.json` (champ `dir`), comme `scripts/raw/_lib.mjs` la dérive
 * déjà côté outillage — une seconde liste en dur mentirait au premier livre extrait de plus.
 *
 * Consommé par le verrou de RÉSOLUBILITÉ de `grammaire/prose.ts` : une adresse dans un livre sans
 * extraction est irrésoluble, et se refuse au PARSE plutôt qu'à la lecture.
 */
import booksJson from '../../books.json';

/** Ids des livres dont l'extraction FR est sur disque (`dir` non vide). */
export const EXTRAITS: ReadonlySet<string> = new Set(
  (booksJson as { id: string; dir?: string }[])
    .filter((b) => typeof b.dir === 'string' && b.dir.length > 0)
    .map((b) => b.id),
);

/** Ce livre a-t-il une extraction FR sur disque ? (`undefined` — pas de livre — n'en est pas une.) */
export function estExtrait(bookId: string | undefined): boolean {
  return bookId !== undefined && EXTRAITS.has(bookId);
}
