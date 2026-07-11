export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const JOURNAL_WRITE_RX: RegExp;
export function scanJournalWrite(relPath: string, contenu: string): Finding[];
export function countJournalWrite(relPath: string, contenu: string): number;
