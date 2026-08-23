export interface Finding {
  line: number;
  detail: string;
}

export function tsSources(root: string, dirs: string[]): { rel: string; code: string }[];
export function scanUnionRecopies(
  relPath: string,
  contenu: string,
  canons: { nom: string; membres: readonly string[] }[],
): Finding[];
export function scanDefinitions(relPath: string, contenu: string, nom: string): Finding[];
