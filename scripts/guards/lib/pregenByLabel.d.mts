export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export function scanPregenByLabel(relPath: string, contenu: string, names: string[]): Finding[];
export function countPregenByLabel(relPath: string, contenu: string, names: string[]): number;
