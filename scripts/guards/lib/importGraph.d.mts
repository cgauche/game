export const IMPORT_RE: RegExp;
export function resolveImport(fromFile: string, spec: string): string | null;
export function closureOf(roots: string[], cache?: Map<string, string[] | null>): Set<string>;
export function directImportsOf(fromFile: string, contenu: string): string[];
