export const FORBIDDEN_SOURCES: string[];
export interface NavalImportFinding {
  line: number;
  source: string;
}
export function scanBatchNavalQuarantine(contenu: string): NavalImportFinding[];
