export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const TRAIT_TALENT_RX: RegExp;
export const PER_ETAT_RX: RegExp;
export const EXCLUDE_RX: RegExp;
export const MACHINERY_RX: RegExp;
export function scanHardcode(relPath: string, contenu: string): Finding[];
export function countHardcode(relPath: string, contenu: string): number;
