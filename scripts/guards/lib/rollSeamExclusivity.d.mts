export interface Finding {
  line: number;
  detail: string;
}

export const ROLL_SEAM_RX: RegExp;
export function scanRollSeamExclusivity(relPath: string, contenu: string): Finding[];
