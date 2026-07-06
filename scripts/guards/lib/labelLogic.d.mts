export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const BY_LABEL_RX: RegExp;
export const LABEL_EQ_RX: RegExp;
export function scanLabelLogic(relPath: string, contenu: string): Finding[];
