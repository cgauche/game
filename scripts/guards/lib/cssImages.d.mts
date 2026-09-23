import type { EntreeManifeste, ImageCss, ventiler } from './cssCouches.mjs';
import type { EntreeNominative } from './stock.mjs';

/** Un arbre lisible : ses fichiers d'un dossier, le texte d'un chemin, les lignes de `src/` d'un motif. */
export interface SourceCss {
  lister: (dossier: string) => readonly string[];
  lire: (rel: string) => string | null;
  grep: (motif: string) => Map<string, string>;
}
export interface CoteCss {
  manifeste: EntreeManifeste[];
  partagees: string[];
  reutilises: Set<string>;
  lire: (rel: string) => string | null;
}
export const RACINE_DES_SOURCES: string;
export function nomDImport(chemin: string): string;
export function nomsDImport(manifeste: readonly EntreeManifeste[]): Set<string>;
export const SPECIFICATEUR_SEUL: RegExp;
export function motifDImport(manifeste: readonly EntreeManifeste[]): string | null;
export function coteCss(source: SourceCss, options?: { racine?: string }): CoteCss;
export function imageCss(source: SourceCss, options?: { racine?: string }): ImageCss;
export function sourceGit(p: {
  cwd?: string;
  arbre: string;
  git?: (args: string[]) => string | null;
}): SourceCss & { existe: () => boolean };
export function renommagesDe(git: (args: string[]) => string | null, bornes: string[]): Map<string, string>;
export const CHEMIN_STOCK_CSS: string;
export function ventilationDeGit(p: {
  cwd?: string;
  base: string;
  tete?: string;
  git?: (args: string[]) => string | null;
}): ReturnType<typeof ventiler> & { stockAvant: Record<'identite' | 'espacement', EntreeNominative[]> };
