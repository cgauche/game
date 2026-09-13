export interface MemoryLinkProblem {
  /** Chemin relatif à la racine du dépôt. */
  file: string;
  /** 1-basée. */
  line: number;
  /** Nature du défaut : `fiche inexistante` (wiki) ou `fichier absent` (markdown de MEMORY.md). */
  kind: string;
  /** Le jeton fautif, tel qu'écrit. */
  tok: string;
}

export const MEMORY_DIR: string;
export const MEMORY_INDEX: string;
export function liveNotes(root: string): string[];
export function scanMemoryLinks(root: string): MemoryLinkProblem[];
export const RACINES_HORS_MEMOIRE: string[];
export const HORS_SCAN: string[];
export function fichiersHorsMemoire(root: string): string[];
export function nomsDeFichesConnues(root: string): Set<string>;
export function scanRepoMemoryLinks(
  root: string,
  options?: { fichiers?: string[]; vocabulaire?: Iterable<string> },
): MemoryLinkProblem[];
export function formatMemoryLinkProblems(problems: MemoryLinkProblem[]): string;
