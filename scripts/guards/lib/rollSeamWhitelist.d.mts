export const ROLL_SEAM_CORE: Set<string>;
export const ROLL_SEAM_PHASE2_STOCK: Map<string, number>;
export const ROLL_SEAM_FILE_WHITELIST: Set<string>;
export function rollSeamExcluded(rel: string): boolean;

/** Registre des chemins de jet (#1066) — entrée de stock : compte MESURÉ + justification ÉCRITE. */
export type StockKind = 'dette' | 'canonique' | 'mixte';
export interface StockEntry {
  n: number;
  kind: StockKind;
  why: string;
}
export const PENDING_JET_FABRICATION_STOCK: Map<string, StockEntry>;
export const ENGINE_DELEGATED_ROLL_STOCK: Map<string, StockEntry>;
export const SEAM_CALLERS: { name: string; file: string; exported: boolean; role: string }[];
