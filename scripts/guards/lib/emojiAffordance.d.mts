export interface Finding {
  line: number;
  detail: string;
}

export const EMOJI_RANGES: [number, number][];
export const ALLOWED_CHARS: Set<string>;
export function isEmoji(cp: number): boolean;
export function emojisIn(text: string): string[];
export function scanEmojiAffordance(relPath: string, contenu: string): Finding[];
