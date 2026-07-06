export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const REACTIVE_RX: RegExp;
export const EXCLUDE_RX: RegExp;
export function scanHardcode(relPath: string, contenu: string): Finding[];
export function countHardcode(relPath: string, contenu: string): number;
