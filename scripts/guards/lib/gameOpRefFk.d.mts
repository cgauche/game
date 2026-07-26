export interface GameOpField {
  key: string;
  op: string;
  field: string;
  array: boolean;
}

export type GameOpFieldTarget =
  | { registry: string; self?: true; legacy?: number }
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

export interface ScanResult {
  offenders: GameOpRefOffender[];
  legacyCounts: Record<string, number>;
  missingResolvers: string[];
}

export const TOLERATED: {
  templates: string[];
  selfRef: string;
  softIds: Record<string, string[]>;
};

export const GAMEOP_FIELD_TARGETS: Record<string, GameOpFieldTarget>;

export function gameOpStringFields(root: string): GameOpField[];
export function auditFieldCoverage(root: string): { derived: GameOpField[]; unclassified: string[]; stale: string[] };
export function collectJsonFiles(dir: string, root: string): JsonSource[];
export function scanGameOpRefs(input: { sources: JsonSource[]; resolvers: Record<string, (id: string) => boolean> }): ScanResult;
export function slackRatchets(legacyCounts: Record<string, number>): { key: string; baseline: number; actual: number }[];
export function formatOffender(o: GameOpRefOffender): string;
