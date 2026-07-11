export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const TABLE_LOOKUP_RX: RegExp;
export function scanTableLookup(relPath: string, contenu: string): Finding[];
export function countTableLookup(relPath: string, contenu: string): number;
