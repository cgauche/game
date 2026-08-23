export interface CorpusFile {
  /** Chemin ABSOLU du fichier. */
  abs: string;
  /** Chemin POSIX relatif à la racine du dépôt. */
  rel: string;
  text: string;
}

export interface ReadCorpusOptions {
  /** Extensions retenues (défaut : `.ts`, `.tsx`). */
  exts?: string[];
  /** Garder les `*.test.*` (défaut : non). */
  tests?: boolean;
}

export function readCorpus(dirs: string[], opts?: ReadCorpusOptions): CorpusFile[];
