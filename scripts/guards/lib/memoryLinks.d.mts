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
export function formatMemoryLinkProblems(problems: MemoryLinkProblem[]): string;
