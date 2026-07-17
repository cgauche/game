export interface FolioRange {
  lo: number;
  hi: number | null;
  file: string;
}

export type FolioVerdict =
  | 'folio-ok'
  | 'folio-ment'
  | 'folio-impossible'
  | 'desc-introuvable'
  | 'livre-hors-atlas'
  | 'desc-trop-courte'
  | 'sans-marqueur';

export interface FolioViolation {
  key: string;
  file: string;
  id: string;
  book: string;
  page: number;
  voie: 'encadrement' | 'hors-livre';
  ranges: FolioRange[];
  max: number | null;
}

export interface FolioMulti {
  key: string;
  page: number;
  ranges: FolioRange[];
}

export const BOOK_ABBR_BY_ID: Record<string, string>;
export const MIN_DESC: number;
export const OPEN: null;

export function normMap(s: string): { text: string; idx: number[] };
export function bookDocs(abbr: string): { file: string; text: string; idx: number[]; folios: [number, number][] }[];
export function bookMaxFolio(abbr: string): number;
export function folioRange(folios: [number, number][], a: number, b: number): { lo: number; hi: number | null } | null;
export function auditFolio(entry: { book: string; page: number; desc: string }): {
  verdict: FolioVerdict;
  ranges?: FolioRange[];
  max?: number;
};
export function citedEntriesOf(data: unknown): { id: string; book: string; page: number; desc: string }[];
export function auditFolios(dataDir: string): {
  violations: FolioViolation[];
  stats: Record<string, number>;
  total: number;
  multi: FolioMulti[];
};
export function renderStock(violations: FolioViolation[], entete: string): string;

export interface SecondaryEntry {
  key: string;
  book: string;
  page: number;
  label: string | undefined;
  quote: string | undefined;
}

export type SecondaryVerdict = 'attesté' | 'non-attesté' | 'folio-impossible' | 'livre-hors-atlas';

export function secondaryEntriesOf(data: unknown): SecondaryEntry[];
export function auditSecondaryRef(entry: {
  book: string;
  page: number;
  label: string | undefined;
  quote: string | undefined;
}): { verdict: SecondaryVerdict; via?: 'label' | 'quote'; max?: number };
export function auditSecondaries(dataDir: string): {
  violations: {
    key: string;
    file: string;
    book: string;
    page: number;
    verdict: 'non-attesté' | 'folio-impossible';
    max?: number;
  }[];
  total: number;
};
