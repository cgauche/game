export interface BlindRef {
  file: string;
  row: number;
  ref: string;
  abbr: string;
  nn: string;
  lo: number;
  hi: number;
}

export interface SiteExemption {
  file: string;
  row: number;
  ref: string;
  raison: string;
  date: string;
}

export interface EmptyLineRef {
  ref: string;
  sites: number;
  blind: number;
  files: Set<string>;
}

export type BlindBaseline = Record<string, Record<string, number>>;

export const SRC_DIR: string;
export const EXCLUDE_SRC_PREFIX: string;
export const WINDOW: number;
export const MIN_WORD_LEN: number;
export const STEM_LEN: number;
export const SELF_FILES: string[];
export const SITE_EXEMPTIONS: SiteExemption[];
export const BASELINE_PATH: URL;

export function chapterFile(abbr: string, nn: string, range?: { from: string; to?: string }):
  { path: string; file: string; dir: string; text?: string } | null;
export function readText(path: string): string;

export function significantWords(text: string, minLen?: number): Set<string>;
export function sharesSignificantWord(a: string, b: string, minLen?: number): boolean;
export function windowText(lines: string[], lo: number, hi: number, w?: number): string;
export function isBlindRef(
  chapterLines: string[], lo: number, hi: number, contextText: string, w?: number, minLen?: number,
): boolean;
export function refsInLine(ln: string): Generator<{ abbr: string; nn: string; lo: number; hi: number; ref: string }>;
export function isExcludedSrc(rel: string): boolean;
export function scanBlindRefs(srcDir?: string): BlindRef[];
export function scanEmptyLineRefs(srcDir?: string): EmptyLineRef[];
export function countsByFileRef(blind: BlindRef[]): BlindBaseline;
export function assertAgainstBaseline(
  counts: BlindBaseline, baseline: BlindBaseline,
): { over: string[]; stale: string[] };
export function readBaseline(path?: URL | string): BlindBaseline;
export function serializeBaseline(counts: BlindBaseline): string;
