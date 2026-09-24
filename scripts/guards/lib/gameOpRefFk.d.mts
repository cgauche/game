export interface GameOpField {
  key: string;
  op: string;
  field: string;
  array: boolean;
}

export type GameOpFieldTarget =
  | { registry: string }
  | { nonRef: string }
  | { coveredBy: string };

export interface GameOpRefOffender {
  file: string;
  path: string;
  op: string;
  field: string;
  value: string;
  registry: string;
  key: string;
}

export interface JsonSource {
  file: string;
  data: unknown;
}

/** Valeur `string` d'un champ d'op à slot, et la CASE `(porteur, cle)` qui la porte. */
export interface OccurrenceASlot {
  file: string;
  path: string;
  key: string;
  porteur: object;
  cle: string | number;
  value: string;
}

export interface ScanResult {
  offenders: GameOpRefOffender[];
  missingResolvers: string[];
  occurrencesASlot: OccurrenceASlot[];
}

export interface CibleStale {
  key: string;
  raison: string;
}

export const GAMEOP_FIELD_TARGETS: Record<string, GameOpFieldTarget>;

export function gameOpStringFields(root: string): GameOpField[];
export function auditFieldCoverage(
  root: string,
  opts: { champsASlot: Iterable<string> },
): { derived: GameOpField[]; unclassified: string[]; stale: CibleStale[] };
export function scanGameOpRefs(input: {
  sources: JsonSource[];
  resolvers: Record<string, (id: string) => boolean>;
  softIds?: Record<string, readonly string[]>;
  champsASlot?: Iterable<string>;
}): ScanResult;
export function formatOffender(o: GameOpRefOffender): string;
