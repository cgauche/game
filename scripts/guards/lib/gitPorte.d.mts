/** Déclarations des lectures git consommées depuis TypeScript (`cssCouchesAudit.ts`). */

/** L'union à TROIS issues d'une lecture git (en-tête de `gitPorte.mjs`). */
export type LectureGit =
  | { disponible: true; valeur: { status: number; stdout: string; stderr: string }; absent?: undefined }
  | { disponible: true; absent: true }
  | { disponible: false; raison: string };

export function lireGit(args: string[], opts?: { cwd?: string; site?: string; timeout?: number; entree?: string }): LectureGit;
/** La sortie d'une lecture réussie, `null` si l'objet est absent ou le code de sortie non nul. */
export function sortieOuNull(union: LectureGit): string | null;
/** Les lignes d'un `git grep -E` sous `pathspecs`, par fichier. */
export function grepDe(
  git: (args: string[]) => string | null,
  portee: string[],
  motif: string,
  pathspecs: readonly string[],
): Map<string, string>;
/** Le texte de chaque chemin dans une ref ou l'index, par un seul `git cat-file --batch`. */
export function lireEnLot(
  git: (args: string[], opts?: { entree?: string }) => string | null,
  arbre: string,
  rels: readonly string[],
): Map<string, string | null>;
export const INDEX: string;
export const TRAVAIL: string;
/** Les fichiers d'une image git sous `dossier` (ref, `INDEX` ou `TRAVAIL`). */
export function listerImage(git: (args: string[]) => string | null, arbre: string, dossier: string): string[];
/** Les entrées directes de `dossier` parmi des chemins complets. */
export function enfantsDirects(chemins: readonly string[], dossier: string): string[];
