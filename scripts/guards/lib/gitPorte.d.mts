/** Déclarations des lectures git consommées depuis TypeScript (`cssCouchesAudit.ts`). */

/** L'union à TROIS issues d'une lecture git (en-tête de `gitPorte.mjs`). */
export type LectureGit =
  | { disponible: true; valeur: { status: number; stdout: string; stderr: string }; absent?: undefined }
  | { disponible: true; absent: true }
  | { disponible: false; raison: string };

export function lireGit(args: string[], opts?: { cwd?: string; site?: string; timeout?: number }): LectureGit;
/** La sortie d'une lecture réussie, `null` si l'objet est absent ou le code de sortie non nul. */
export function sortieOuNull(union: LectureGit): string | null;
/** Les lignes d'un `git grep -E` sous `dossiers`, par fichier. */
export function grepDe(
  git: (args: string[]) => string | null,
  portee: string[],
  motif: string,
  dossiers: readonly string[],
): Map<string, string>;
