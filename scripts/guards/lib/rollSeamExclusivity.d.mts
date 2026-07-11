export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const ROLL_SEAM_RX: RegExp;
export function scanRollSeamExclusivity(relPath: string, contenu: string): Finding[];
export function countRollSeamExclusivity(relPath: string, contenu: string): number;
