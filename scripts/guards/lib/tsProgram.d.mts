import type { Program } from 'typescript';

/** Racine des programmes bâtis par `virtualProgram`. */
export const VIRTUAL_ROOT: string;

/** Programme du dépôt (options du `tsconfig.json` de `root`), racines choisies par l'appelant. */
export function repoProgram(
  root: string,
  choisirRootNames: (fileNames: readonly string[], root: string) => string[]
): Program;

/** Programme bâti sur des sources EN MÉMOIRE (`chemin relatif` → contenu). */
export function virtualProgram(files: Record<string, string>): Program;
