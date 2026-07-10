export interface Finding {
  line: number;
  detail: string;
}

export function stripComments(src: string): string;
export const IN_BATTLE_FIND_RX: RegExp;
export function scanInBattleFind(relPath: string, contenu: string): Finding[];
export function countInBattleFind(relPath: string, contenu: string): number;
