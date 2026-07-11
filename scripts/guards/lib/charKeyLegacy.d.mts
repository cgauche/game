export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const CHAR_KEY_LEGACY_RX: RegExp;
export function scanCharKeyLegacy(relPath: string, contenu: string): Finding[];
export function countCharKeyLegacy(relPath: string, contenu: string): number;
