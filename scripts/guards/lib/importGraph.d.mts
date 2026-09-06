export const IMPORT_RE: RegExp;
export function resolveImport(fromFile: string, spec: string): string | null;
export function clotureDImports(
  roots: string[],
  options?: { retenir?: (abs: string) => boolean; cache?: Map<string, string[] | null> },
): Set<string>;
export function closureOf(roots: string[], cache?: Map<string, string[] | null>): Set<string>;
export function directImportsOf(fromFile: string, contenu: string): string[];
