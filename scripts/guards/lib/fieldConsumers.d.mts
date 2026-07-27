export interface FieldReadHit {
  field: string;
  file: string;
  line: number;
}

export function listProdFiles(dir: string, out?: string[]): string[];
export function scanFieldReads(typeName: string, fields: string[], files: string[], rootDir: string): FieldReadHit[];
export function groupByField(fields: string[], hits: FieldReadHit[]): Map<string, FieldReadHit[]>;
