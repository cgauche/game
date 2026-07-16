export interface Finding {
  line: number;
  detail: string;
}

export const REGEN_RECIPE: string;
export function scanNpmLockHoisted(contenu: string): Finding[];
