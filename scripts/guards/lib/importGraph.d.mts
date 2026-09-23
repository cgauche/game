export const IMPORT_RE: RegExp;
export function sourceALExecution(fichier: string, texte: string): string;
export function resolveImport(fromFile: string, spec: string, existe?: (abs: string) => boolean): string | null;
export function clotureDImports(
  roots: string[],
  options?: { retenir?: (abs: string) => boolean; cache?: Map<string, string[] | null>; typesEffaces?: boolean },
): Set<string>;
export function closureOf(roots: string[], cache?: Map<string, string[] | null>): Set<string>;
export function directImportsOf(
  fromFile: string,
  contenu: string,
  options?: { racine?: string; existe?: (abs: string) => boolean },
): string[];
/** Les alias de chemin du dépôt (`tsconfig.json` `paths`) : préfixe du spécificateur → dossier cible absolu. */
export function aliasDuDepot(): { prefixe: string; vers: string }[];
