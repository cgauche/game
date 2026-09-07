/** Entrée de corpus, GELÉE : le corpus est mémoïsé et partagé entre appelants. */
export interface CorpusFile {
  /** Chemin ABSOLU du fichier. */
  readonly abs: string;
  /** Chemin POSIX relatif à la racine du dépôt. */
  readonly rel: string;
  readonly text: string;
}

export interface ReadCorpusOptions {
  /** Extensions retenues (défaut : `.ts`, `.tsx`). */
  exts?: string[];
  /** Garder les `*.test.*` (défaut : non). */
  tests?: boolean;
}

/** Corpus MÉMOÏSÉ par clé (dossiers + extensions + `tests`) : même clé = même tableau, gelé. Les
 *  dossiers entrent dans la clé en chemin POSIX depuis la racine — absolu, relatif et séparateur
 *  final désignent le MÊME corpus. Licéité et prix : en-tête de `sourceCorpus.mjs`. */
export function readCorpus(dirs: string[], opts?: ReadCorpusOptions): readonly CorpusFile[];

/** Relâche tous les corpus mémoïsés : la lecture suivante retourne au disque. */
export function viderCorpus(): void;
