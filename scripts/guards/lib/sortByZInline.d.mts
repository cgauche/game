export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const SORT_BY_Z_INLINE_RX: RegExp;
export const SORT_BY_Z_WHITELIST: string[];
export function scanSortByZInline(relPath: string, contenu: string): Finding[];
export function countSortByZInline(relPath: string, contenu: string): number;
