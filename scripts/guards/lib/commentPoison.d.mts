export interface Comment {
  text: string;
  line: number;
}

export interface Finding {
  line: number;
  detail: string;
}

export function extractComments(src: string): Comment[];
export function matchLine(comment: Comment, matchIndex: number): number;
export function excerptAt(comment: Comment, matchIndex: number): string;

export const TOMBSTONE_FAMILIES: { rx: RegExp; label: string }[];
export function tombstonesIn(text: string): string[];
export function scanTombstones(relPath: string, contenu: string): Finding[];

export const EXCUSE_GUARD_ACTIVE: boolean;
export const EXCUSE_RX: RegExp;
export const ENTERINE_TAG_RX: RegExp;
export function untaggedExcuseMatch(text: string): RegExpExecArray | null;
export function scanExcuses(relPath: string, contenu: string): Finding[];
